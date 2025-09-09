import * as path from 'node:path';

import { logger } from '@utils/logger';
import { getProjectRoot } from '@utils/paths';
import * as fs from 'fs-extra';
import { z } from 'zod';

// User configuration schema
export const userConfigSchema = z.object({
  projectsPath: z.string(),
  integrations: z.object({
    github: z
      .object({
        sshKeyConfigured: z.boolean().default(false),
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

export type UserConfig = z.infer<typeof userConfigSchema>;

const configPath = path.join(getProjectRoot(), 'user.config.json');

/**
 * Load user configuration from JSON file
 */
export function loadUserConfig(): UserConfig | null {
  if (fs.existsSync(configPath)) {
    try {
      const rawConfig = fs.readJsonSync(configPath);
      return userConfigSchema.parse(rawConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Invalid configuration file:', error.errors);
        throw error;
      }
      throw error;
    }
  }

  return null;
}

/**
 * Save UserConfig and regenerate .env
 */
export async function saveUserConfig(config: UserConfig): Promise<void> {
  try {
    const validatedConfig = userConfigSchema.parse(config);
    await fs.writeJson(configPath, validatedConfig, { spaces: 2 });

    // Regenerate .env file
    const { generateEnvFile } = await import('./environment');
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
 * Check if user config exists
 */
export async function userConfigExists(): Promise<boolean> {
  return fs.pathExists(configPath);
}

/**
 * Get current user config (errors if not configured)
 */
export function getUserConfig(): UserConfig {
  const loaded = loadUserConfig();
  if (loaded) {
    return loaded;
  }

  // Error if no config exists
  throw new Error('User configuration not found. Please run "devvy setup" first.');
}
