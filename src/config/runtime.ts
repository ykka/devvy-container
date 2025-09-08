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

// Module-level state
let devvyConfig: DevvyConfig | null = null;
let envConfig: EnvConfig | null = null;

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'devvy.config.json');
const envPath = path.join(projectRoot, CONSTANTS.HOST_PATHS.ENV_FILE);

/**
 * Load environment configuration from .env file
 */
export function loadEnvConfig(): EnvConfig {
  dotenv.config({ path: envPath });

  try {
    envConfig = envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.debug('Environment configuration validation:', { errors: error.errors });
      // Use defaults for missing values
      envConfig = envSchema.parse({});
    }
  }

  if (!envConfig) {
    envConfig = envSchema.parse({});
  }

  return envConfig;
}

/**
 * Load devvy configuration from JSON file
 */
export function loadConfig(): DevvyConfig | null {
  if (devvyConfig) {
    return devvyConfig;
  }

  if (fs.existsSync(configPath)) {
    try {
      const rawConfig = fs.readJsonSync(configPath);
      devvyConfig = devvyConfigSchema.parse(rawConfig);
      return devvyConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid configuration file:', error.errors);
        throw error;
      }
    }
  }

  return null;
}

/**
 * Save DevvyConfig and regenerate .env
 */
export async function saveConfig(config: DevvyConfig): Promise<void> {
  try {
    const validatedConfig = devvyConfigSchema.parse(config);
    await fs.writeJson(configPath, validatedConfig, { spaces: 2 });
    devvyConfig = validatedConfig;

    // Regenerate .env file
    await generateEnvFile(validatedConfig);

    logger.debug('Configuration saved:', { path: configPath });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Invalid configuration:', error.errors);
    }
    throw error;
  }
}

/**
 * Generate .env file from DevvyConfig
 */
export async function generateEnvFile(config: DevvyConfig): Promise<void> {
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
    `PROJECTS_PATH=${config.projectsPath}`,
    '',
  ];

  // Integrations
  if (config.integrations.github?.token) {
    envLines.push('# GitHub Integration');
    envLines.push(`GITHUB_TOKEN=${config.integrations.github.token}`);
    envLines.push('');
  }

  if (config.integrations.linear?.apiKey) {
    envLines.push('# Linear Integration');
    envLines.push(`LINEAR_API_KEY=${config.integrations.linear.apiKey}`);
    envLines.push('');
  }

  // Editor settings
  if (config.editor.lazyvim) {
    envLines.push('# Editor Configuration');
    envLines.push(`INSTALL_LAZYVIM=${config.editor.lazyvim.enabled}`);
    if (config.editor.lazyvim.readOnlyConfigPath) {
      envLines.push(`LAZYVIM_CONFIG_PATH=${config.editor.lazyvim.readOnlyConfigPath}`);
    }
    envLines.push('');
  }

  // Terminal settings
  if (config.terminal.tmux?.readOnlyConfigPath) {
    envLines.push('# Terminal Configuration');
    envLines.push(`TMUX_CONFIG_PATH=${config.terminal.tmux.readOnlyConfigPath}`);
    envLines.push('');
  }

  // Firewall allowed domains
  if (config.firewall?.allowedDomains) {
    envLines.push('# Firewall Configuration');
    envLines.push(`FIREWALL_ALLOWED_DOMAINS="${config.firewall.allowedDomains.join(',')}"`);
    envLines.push('');
  }

  await fs.writeFile(envPath, envLines.join('\n'));
  logger.debug('Environment file generated:', { path: envPath });

  // Reload env config after generating
  loadEnvConfig();
}

/**
 * Validate environment variables before container operations
 */
export async function validateEnvironment(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  const env = loadEnvConfig();

  // Check required paths exist
  if (env.PROJECTS_PATH) {
    const expandedPath = expandPath(env.PROJECTS_PATH);
    if (!(await fs.pathExists(expandedPath))) {
      errors.push(`Projects path does not exist: ${env.PROJECTS_PATH}`);
    }
  }

  if (env.LAZYVIM_CONFIG_PATH) {
    const expandedPath = expandPath(env.LAZYVIM_CONFIG_PATH);
    if (!(await fs.pathExists(expandedPath))) {
      errors.push(`LazyVim config path does not exist: ${env.LAZYVIM_CONFIG_PATH}`);
    }
  }

  if (env.TMUX_CONFIG_PATH) {
    const expandedPath = expandPath(env.TMUX_CONFIG_PATH);
    if (!(await fs.pathExists(expandedPath))) {
      errors.push(`Tmux config path does not exist: ${env.TMUX_CONFIG_PATH}`);
    }
  }

  // Validate SSH keys exist
  const sshKeyPath = path.join(projectRoot, CONSTANTS.HOST_PATHS.SECRETS_DIR, CONSTANTS.SSH.KEY_NAME);
  if (!(await fs.pathExists(sshKeyPath))) {
    errors.push('SSH keys not found. Run "devvy setup" first.');
  }

  // Validate docker-compose.yml exists
  const composePath = path.join(projectRoot, CONSTANTS.DOCKER.COMPOSE_FILE);
  if (!(await fs.pathExists(composePath))) {
    errors.push('docker-compose.yml not found');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Expand tilde in path
 */
export function expandPath(p: string): string {
  if (p.startsWith('~')) {
    const home = require('node:os').homedir();
    return path.join(home, p.slice(1));
  }
  return p;
}

/**
 * Check if config exists
 */
export async function configExists(): Promise<boolean> {
  return fs.pathExists(configPath);
}

/**
 * Get current config or defaults
 */
export function getConfig(): DevvyConfig {
  if (devvyConfig) {
    return devvyConfig;
  }

  // Try to load
  const loaded = loadConfig();
  if (loaded) {
    return loaded;
  }

  // Return defaults
  const { getDefaultProjectsPath } = require('./defaults');
  return devvyConfigSchema.parse({
    projectsPath: getDefaultProjectsPath(),
    integrations: {},
    editor: {},
    terminal: {},
  });
}

/**
 * Get current env config
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    return loadEnvConfig();
  }
  return envConfig;
}
