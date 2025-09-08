import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Get default projects path
 */
export function getDefaultProjectsPath(): string {
  const home = os.homedir();
  return path.join(home, 'Repos', 'devvy-repos');
}

/**
 * Get default LazyVim config path
 */
export function getDefaultLazyvimPath(): string {
  const home = os.homedir();
  return path.join(home, '.config', 'nvim');
}

/**
 * Get default tmux config path
 */
export function getDefaultTmuxPath(): string {
  const home = os.homedir();
  return path.join(home, '.config', 'tmux');
}
