import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';

const projectRoot = process.cwd();

/**
 * Get project root directory
 */
export function getProjectRoot(): string {
  return projectRoot;
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return path.join(projectRoot, 'devvy.config.json');
}

/**
 * Get env file path
 */
export function getEnvPath(): string {
  return path.join(projectRoot, CONSTANTS.HOST_PATHS.ENV_FILE);
}

/**
 * Get absolute path from relative
 */
export function getAbsolutePath(relativePath: string): string {
  return path.join(projectRoot, relativePath);
}
