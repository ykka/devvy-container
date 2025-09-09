import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import type { UserConfig } from '@config/user-config';
import { logger } from '@utils/logger';
import { expandPath, getProjectRoot } from '@utils/paths';
import { exec } from '@utils/shell';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import { z } from 'zod';

export const envSchema = z.object({
  // User Configuration for runtime UID/GID matching
  HOST_UID: z.string().regex(/^\d+$/),
  HOST_GID: z.string().regex(/^\d+$/),

  // Git Configuration
  GIT_USER_NAME: z.string(),
  GIT_USER_EMAIL: z.string().email().or(z.string()),

  // Paths
  PROJECTS_PATH: z.string(),
  LAZYVIM_CONFIG_PATH: z.string().optional(),
  TMUX_CONFIG_PATH: z.string().optional(),

  // Optional Integrations
  GITHUB_TOKEN: z.string().optional(),

  // System
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']),

  // LazyVim
  INSTALL_LAZYVIM: z.enum(['true', 'false']),
});

export type EnvConfig = z.infer<typeof envSchema>;

const envPath = path.join(getProjectRoot(), CONSTANTS.HOST_PATHS.ENV_FILE);

/**
 * Load environment configuration from .env file
 */
export function loadEnvConfig(): EnvConfig {
  dotenv.config({ path: envPath });

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Environment configuration validation failed:', { errors: error.errors });
      throw new Error(`Missing required environment variables: ${error.errors.map((e) => e.path.join('.')).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Generate .env file from UserConfig
 */
export async function generateEnvFile(config: UserConfig): Promise<void> {
  // Get host user/group IDs
  const userIdResult = await exec('id', ['-u']);
  const groupIdResult = await exec('id', ['-g']);

  if (!userIdResult.success) {
    throw new Error(`Failed to get user ID: ${userIdResult.stderr || 'Unknown error'}`);
  }
  if (!groupIdResult.success) {
    throw new Error(`Failed to get group ID: ${groupIdResult.stderr || 'Unknown error'}`);
  }

  const hostUid = userIdResult.stdout.trim();
  const hostGid = groupIdResult.stdout.trim();

  // Get git config from system
  const gitNameResult = await exec('git', ['config', '--global', 'user.name']);
  const gitEmailResult = await exec('git', ['config', '--global', 'user.email']);
  const gitName = gitNameResult.success ? gitNameResult.stdout.trim() : 'Your Name';
  const gitEmail = gitEmailResult.success ? gitEmailResult.stdout.trim() : 'your.email@example.com';

  // Build environment variables
  const envLines: string[] = [
    '# Generated from user.config.json - DO NOT EDIT DIRECTLY',
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
    '# System',
    `LOG_LEVEL=info`,
    '',
    '# LazyVim installation',
    `INSTALL_LAZYVIM=${config.editor.lazyvim?.enabled === true ? 'true' : 'false'}`,
    '',
  ];

  // Integrations
  if (config.integrations.github?.token) {
    envLines.push('# GitHub Integration');
    envLines.push(`GITHUB_TOKEN=${config.integrations.github.token}`);
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
  const sshKeyPath = path.join(getProjectRoot(), CONSTANTS.HOST_PATHS.SECRETS_DIR, CONSTANTS.SSH.KEY_NAME);
  if (!(await fs.pathExists(sshKeyPath))) {
    errors.push('SSH keys not found. Run "devvy setup" first.');
  }

  // Validate docker-compose.yml exists
  const composePath = path.join(getProjectRoot(), CONSTANTS.DOCKER.COMPOSE_FILE);
  if (!(await fs.pathExists(composePath))) {
    errors.push('docker-compose.yml not found');
  }

  return { valid: errors.length === 0, errors };
}
