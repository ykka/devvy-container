import * as path from 'node:path';

import { logger } from '@utils/logger';
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

export type DevvyConfig = z.infer<typeof devvyConfigSchema>;

// Module-level state
let devvyConfig: DevvyConfig | null = null;

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'devvy.config.json');

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
 * Get project root directory
 */
export function getProjectRoot(): string {
  return projectRoot;
}
