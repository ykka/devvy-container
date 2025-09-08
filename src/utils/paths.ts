import * as os from 'node:os';
import * as path from 'node:path';

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
 * Normalize and expand a path
 */
export function normalizePath(filePath: string): string {
  return path.normalize(expandPath(filePath));
}

/**
 * Get absolute path from relative path
 * @param relativePath - Path relative to current working directory
 * @param basePath - Optional base path (defaults to process.cwd())
 */
export function getAbsolutePath(relativePath: string, basePath?: string): string {
  const base = basePath || process.cwd();
  return path.isAbsolute(relativePath) ? relativePath : path.join(base, relativePath);
}
