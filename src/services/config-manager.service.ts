import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import { exec } from '@utils/shell';
import * as fs from 'fs-extra';

export interface DevvyConfig {
  projectsPath: string;
  integrations: {
    github?: {
      token: string;
    };
    linear?: {
      apiKey: string;
    };
  };
  databases?: {
    postgresql?: string;
    mongodb?: string;
    supabase?: {
      url: string;
      anonKey: string;
    };
  };
  editor: {
    lazyvim?: {
      enabled: boolean;
      readOnlyConfigPath?: string;
    };
  };
  terminal: {
    tmux?: {
      readOnlyConfigPath?: string;
    };
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private envPath: string;

  private constructor() {
    const projectRoot = process.cwd();
    this.configPath = path.join(projectRoot, 'devvy.config.json');
    this.envPath = path.join(projectRoot, CONSTANTS.PATHS.ENV_FILE);
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async loadConfig(): Promise<DevvyConfig | null> {
    try {
      if (await fs.pathExists(this.configPath)) {
        const content = await fs.readJson(this.configPath);
        return content as DevvyConfig;
      }
    } catch (error) {
      logger.debug('Failed to load config:', error as Record<string, unknown>);
    }
    return null;
  }

  async saveConfig(config: DevvyConfig): Promise<void> {
    await fs.writeJson(this.configPath, config, { spaces: 2 });
    logger.debug('Config saved to:', { path: this.configPath });
  }

  async generateEnvFile(config: DevvyConfig): Promise<void> {
    // Get host user/group IDs for permission matching
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
      '# Git Configuration (from system)',
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

    // Databases
    if (config.databases) {
      envLines.push('# Database Connections');
      if (config.databases.postgresql) {
        envLines.push(`DATABASE_URL=${config.databases.postgresql}`);
      }
      if (config.databases.mongodb) {
        envLines.push(`MONGODB_URI=${config.databases.mongodb}`);
      }
      if (config.databases.supabase) {
        envLines.push(`SUPABASE_URL=${config.databases.supabase.url}`);
        envLines.push(`SUPABASE_ANON_KEY=${config.databases.supabase.anonKey}`);
      }
      envLines.push('');
    }

    // Editor settings
    envLines.push('# Editor Configuration');
    if (config.editor.lazyvim) {
      envLines.push(`INSTALL_LAZYVIM=${config.editor.lazyvim.enabled}`);
      if (config.editor.lazyvim.readOnlyConfigPath) {
        envLines.push(`LAZYVIM_CONFIG_PATH=${config.editor.lazyvim.readOnlyConfigPath}`);
      }
    }
    envLines.push('');

    // Terminal settings
    if (config.terminal.tmux?.readOnlyConfigPath) {
      envLines.push('# Terminal Configuration');
      envLines.push(`TMUX_CONFIG_PATH=${config.terminal.tmux.readOnlyConfigPath}`);
      envLines.push('');
    }

    await fs.writeFile(this.envPath, envLines.join('\n'));
    logger.debug('Environment file generated:', { path: this.envPath });
  }

  async configExists(): Promise<boolean> {
    return fs.pathExists(this.configPath);
  }

  getDefaultProjectsPath(): string {
    const home = process.env.HOME || '~';
    return path.join(home, 'Repos', 'devvy-repos');
  }

  getDefaultLazyvimPath(): string {
    const home = process.env.HOME || '~';
    return path.join(home, '.config', 'nvim');
  }

  getDefaultTmuxPath(): string {
    const home = process.env.HOME || '~';
    return path.join(home, '.config', 'tmux');
  }
}
