import * as os from 'node:os';
import * as path from 'node:path';

const projectRoot = process.cwd();

/**
 * Expand tilde (~) in file paths to user's home directory
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~')) {
    const home = os.homedir();
    return path.join(home, filePath.slice(1));
  }
  return filePath;
}

/**
 * Get project root directory
 */
export function getProjectRoot(): string {
  return projectRoot;
}
