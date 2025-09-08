import * as os from 'node:os';
import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import { exec } from '@utils/shell';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import { z } from 'zod';

// Unified configuration schema
export const devvyConfigSchema = z.object({
  projectsPath: z.string(),
  integrations: z.object({
    github: z
      .object({
        token: z.string(),
      })
      .optional(),
    linear: z
      .object({
        apiKey: z.string(),
      })
      .optional(),
  }),
  editor: z.object({
    lazyvim: z
      .object({
        enabled: z.boolean(),
        readOnlyConfigPath: z.string().optional(),
      })
      .optional(),
  }),
  terminal: z.object({
    tmux: z
      .object({
        readOnlyConfigPath: z.string().optional(),
      })
      .optional(),
  }),
  firewall: z
    .object({
      allowedDomains: z
        .array(z.string())
        .default([
          'docs.anthropic.com',
          'nextjs.org',
          'reactjs.org',
          'nodejs.org',
          'developer.mozilla.org',
          'stackoverflow.com',
          'github.com',
          'npmjs.com',
          'typescript-eslint.io',
          'eslint.org',
          'prettier.io',
          'vitejs.dev',
          'webpack.js.org',
        ]),
    })
    .default({}),
});

export const envSchema = z.object({
  // User Configuration for runtime UID/GID matching
  HOST_UID: z.string().regex(/^\d+$/).default('1000'),
  HOST_GID: z.string().regex(/^\d+$/).default('1000'),

  // Git Configuration
  GIT_USER_NAME: z.string().default('Your Name'),
  GIT_USER_EMAIL: z.string().email().or(z.string()).default('your.email@example.com'),

  // Paths
  PROJECTS_PATH: z.string(),
  LAZYVIM_CONFIG_PATH: z.string().optional(),
  TMUX_CONFIG_PATH: z.string().optional(),

  // Optional Integrations
  GITHUB_TOKEN: z.string().optional(),
  LINEAR_API_KEY: z.string().optional(),

  // Docker/System
  DOCKER_HOST: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // LazyVim
  INSTALL_LAZYVIM: z.enum(['true', 'false']).default('false'),
});

export type DevvyConfig = z.infer<typeof devvyConfigSchema>;
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Configuration Service
 * Single source of truth for all configuration
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: DevvyConfig | null = null;
  private envConfig: EnvConfig | null = null;
  private readonly configPath: string;
  private readonly envPath: string;
  private readonly projectRoot: string;

  private constructor() {
    this.projectRoot = process.cwd();
    this.configPath = path.join(this.projectRoot, 'devvy.config.json');
    this.envPath = path.join(this.projectRoot, CONSTANTS.HOST_PATHS.ENV_FILE);
    this.loadConfiguration();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfiguration(): void {
    // Load environment variables first
    this.loadEnvConfig();

    // Then load devvy config
    this.loadDevvyConfig();
  }

  private loadEnvConfig(): void {
    dotenv.config({ path: this.envPath });

    try {
      // Parse with defaults
      this.envConfig = envSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.debug('Environment configuration validation:', { errors: error.errors });
        // Use defaults for missing values
        this.envConfig = envSchema.parse({});
      }
    }
  }

  private loadDevvyConfig(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const rawConfig = fs.readJsonSync(this.configPath);
        this.config = devvyConfigSchema.parse(rawConfig);
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('Invalid configuration file:', error.errors);
          throw error;
        }
      }
    }
  }

  /**
   * Validate environment variables before container operations
   */
  public async validateEnvironment(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.envConfig) {
      errors.push('No environment configuration loaded');
      return { valid: false, errors };
    }

    // Check required paths exist
    if (this.envConfig.PROJECTS_PATH) {
      const expandedPath = this.expandPath(this.envConfig.PROJECTS_PATH);
      if (!(await fs.pathExists(expandedPath))) {
        errors.push(`Projects path does not exist: ${this.envConfig.PROJECTS_PATH}`);
      }
    }

    if (this.envConfig.LAZYVIM_CONFIG_PATH) {
      const expandedPath = this.expandPath(this.envConfig.LAZYVIM_CONFIG_PATH);
      if (!(await fs.pathExists(expandedPath))) {
        errors.push(`LazyVim config path does not exist: ${this.envConfig.LAZYVIM_CONFIG_PATH}`);
      }
    }

    if (this.envConfig.TMUX_CONFIG_PATH) {
      const expandedPath = this.expandPath(this.envConfig.TMUX_CONFIG_PATH);
      if (!(await fs.pathExists(expandedPath))) {
        errors.push(`Tmux config path does not exist: ${this.envConfig.TMUX_CONFIG_PATH}`);
      }
    }

    // Validate SSH keys exist
    const sshKeyPath = path.join(this.projectRoot, CONSTANTS.HOST_PATHS.SECRETS_DIR, CONSTANTS.SSH.KEY_NAME);
    if (!(await fs.pathExists(sshKeyPath))) {
      errors.push('SSH keys not found. Run "devvy setup" first.');
    }

    // Validate docker-compose.yml exists
    const composePath = path.join(this.projectRoot, CONSTANTS.DOCKER.COMPOSE_FILE);
    if (!(await fs.pathExists(composePath))) {
      errors.push('docker-compose.yml not found');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate .env file from DevvyConfig
   */
  public async generateEnvFile(config?: DevvyConfig): Promise<void> {
    const configToUse = config || this.config;
    if (!configToUse) {
      throw new Error('No configuration to generate env file from');
    }

    // Get host user/group IDs
    const userIdResult = await exec('id', ['-u']);
    const groupIdResult = await exec('id', ['-g']);
    const hostUid = userIdResult.success ? userIdResult.stdout.trim() : '1000';
    const hostGid = groupIdResult.success ? groupIdResult.stdout.trim() : '1000';

    // Get git config from system
    const gitNameResult = await exec('git', ['config', '--global', 'user.name']);
    const gitEmailResult = await exec('git', ['config', '--global', 'user.email']);
    const gitName = gitNameResult.success ? gitNameResult.stdout.trim() : 'Your Name';
    const gitEmail = gitEmailResult.success ? gitEmailResult.stdout.trim() : 'your.email@example.com';

    // Build environment variables
    const envLines: string[] = [
      '# Generated from devvy.config.json - DO NOT EDIT DIRECTLY',
      '# Run "devvy setup" to modify configuration',
      '',
      '# User IDs for permission matching',
      `HOST_UID=${hostUid}`,
      `HOST_GID=${hostGid}`,
      '',
      '# Git Configuration',
      `GIT_USER_NAME="${gitName}"`,
      `GIT_USER_EMAIL="${gitEmail}"`,
      '',
      '# Projects directory',
      `PROJECTS_PATH=${configToUse.projectsPath}`,
      '',
    ];

    // Integrations
    if (configToUse.integrations.github?.token) {
      envLines.push('# GitHub Integration');
      envLines.push(`GITHUB_TOKEN=${configToUse.integrations.github.token}`);
      envLines.push('');
    }

    if (configToUse.integrations.linear?.apiKey) {
      envLines.push('# Linear Integration');
      envLines.push(`LINEAR_API_KEY=${configToUse.integrations.linear.apiKey}`);
      envLines.push('');
    }

    // Editor settings
    if (configToUse.editor.lazyvim) {
      envLines.push('# Editor Configuration');
      envLines.push(`INSTALL_LAZYVIM=${configToUse.editor.lazyvim.enabled}`);
      if (configToUse.editor.lazyvim.readOnlyConfigPath) {
        envLines.push(`LAZYVIM_CONFIG_PATH=${configToUse.editor.lazyvim.readOnlyConfigPath}`);
      }
      envLines.push('');
    }

    // Terminal settings
    if (configToUse.terminal.tmux?.readOnlyConfigPath) {
      envLines.push('# Terminal Configuration');
      envLines.push(`TMUX_CONFIG_PATH=${configToUse.terminal.tmux.readOnlyConfigPath}`);
      envLines.push('');
    }

    // Firewall allowed domains
    if (configToUse.firewall?.allowedDomains) {
      envLines.push('# Firewall Configuration');
      envLines.push(`FIREWALL_ALLOWED_DOMAINS="${configToUse.firewall.allowedDomains.join(',')}"`);
      envLines.push('');
    }

    await fs.writeFile(this.envPath, envLines.join('\n'));
    logger.debug('Environment file generated:', { path: this.envPath });

    // Reload env config after generating
    this.loadEnvConfig();
  }

  /**
   * Save DevvyConfig and regenerate .env
   */
  public async saveConfig(config: DevvyConfig): Promise<void> {
    try {
      const validatedConfig = devvyConfigSchema.parse(config);
      await fs.writeJson(this.configPath, validatedConfig, { spaces: 2 });
      this.config = validatedConfig;

      // Regenerate .env file
      await this.generateEnvFile(validatedConfig);

      logger.debug('Configuration saved:', { path: this.configPath });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid configuration:', error.errors);
      }
      throw error;
    }
  }

  /**
   * Load existing config
   */
  public async loadConfig(): Promise<DevvyConfig | null> {
    if (this.config) {
      return this.config;
    }

    try {
      if (await fs.pathExists(this.configPath)) {
        const content = await fs.readJson(this.configPath);
        this.config = devvyConfigSchema.parse(content);
        return this.config;
      }
    } catch (error) {
      logger.debug('Failed to load config:', error as Record<string, unknown>);
    }
    return null;
  }

  // Getters for different config sections
  public get(): DevvyConfig {
    if (!this.config) {
      // Return defaults if no config loaded
      return devvyConfigSchema.parse({
        projectsPath: this.getDefaultProjectsPath(),
        integrations: {},
        editor: {},
        terminal: {},
      });
    }
    return this.config;
  }

  public getEnv(): EnvConfig {
    if (!this.envConfig) {
      return envSchema.parse({});
    }
    return this.envConfig;
  }

  public getDockerConfig() {
    return {
      composeFile: CONSTANTS.DOCKER.COMPOSE_FILE,
      projectName: CONSTANTS.DOCKER.PROJECT_NAME,
      containerName: CONSTANTS.DOCKER.CONTAINER_NAME,
    };
  }

  public getSshConfig() {
    return {
      port: CONSTANTS.SSH.PORT,
      user: CONSTANTS.CONTAINER_USER.NAME,
    };
  }

  public getWorkspaceConfig() {
    return {
      mountPath: CONSTANTS.CONTAINER_USER.REPOS_PATH,
    };
  }

  public getVscodeConfig() {
    return {
      syncEnabled: CONSTANTS.VSCODE.SYNC_ENABLED,
    };
  }

  public getLoggingConfig() {
    return {
      level: CONSTANTS.LOGGING.LEVEL,
    };
  }

  public getFirewallConfig(): DevvyConfig['firewall'] {
    return this.get().firewall;
  }

  // Helper methods
  public async configExists(): Promise<boolean> {
    return fs.pathExists(this.configPath);
  }

  public getProjectRoot(): string {
    return this.projectRoot;
  }

  public getAbsolutePath(relativePath: string): string {
    return path.join(this.projectRoot, relativePath);
  }

  public expandPath(p: string): string {
    if (p.startsWith('~')) {
      return path.join(os.homedir(), p.slice(1));
    }
    return p;
  }

  public getDefaultProjectsPath(): string {
    const home = os.homedir();
    return path.join(home, 'Repos', 'devvy-repos');
  }

  public getDefaultLazyvimPath(): string {
    const home = os.homedir();
    return path.join(home, '.config', 'nvim');
  }

  public getDefaultTmuxPath(): string {
    const home = os.homedir();
    return path.join(home, '.config', 'tmux');
  }
}
