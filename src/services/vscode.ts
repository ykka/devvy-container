import * as os from 'node:os';
import * as path from 'node:path';

import { logger } from '@utils/logger';
import { run } from '@utils/shell';
import * as fs from 'fs-extra';

export type EditorType = 'vscode' | 'cursor';

// Module-level constants
const projectConfigDir = path.join(process.cwd(), 'vscode-config');

/**
 * Get editor configuration paths
 */
function getEditorPaths(type: EditorType) {
  const homeDir = os.homedir();
  const platform = process.platform;

  if (type === 'cursor') {
    const basePath =
      platform === 'darwin'
        ? path.join(homeDir, 'Library', 'Application Support', 'Cursor')
        : platform === 'win32'
          ? path.join(homeDir, 'AppData', 'Roaming', 'Cursor')
          : path.join(homeDir, '.config', 'Cursor');

    return {
      type: 'cursor',
      name: 'Cursor',
      configPath: basePath,
      settingsPath: path.join(basePath, 'User', 'settings.json'),
      keybindingsPath: path.join(basePath, 'User', 'keybindings.json'),
      extensionsPath: platform === 'darwin' ? path.join(homeDir, '.cursor', 'extensions') : path.join(basePath, 'extensions'),
      snippetsPath: path.join(basePath, 'User', 'snippets'),
      commandName: 'cursor',
    };
  }

  // VS Code paths
  const basePath =
    platform === 'darwin'
      ? path.join(homeDir, 'Library', 'Application Support', 'Code')
      : platform === 'win32'
        ? path.join(homeDir, 'AppData', 'Roaming', 'Code')
        : path.join(homeDir, '.config', 'Code');

  return {
    type: 'vscode',
    name: 'VS Code',
    configPath: basePath,
    settingsPath: path.join(basePath, 'User', 'settings.json'),
    keybindingsPath: path.join(basePath, 'User', 'keybindings.json'),
    extensionsPath: platform === 'darwin' ? path.join(homeDir, '.vscode', 'extensions') : path.join(basePath, 'extensions'),
    snippetsPath: path.join(basePath, 'User', 'snippets'),
    commandName: 'code',
  };
}

/**
 * Detect installed editor
 */
export async function detectEditor(): Promise<EditorType | null> {
  // Check for Cursor first (since it's a fork of VS Code)
  const cursorPaths = getEditorPaths('cursor');
  if (await fs.pathExists(cursorPaths.configPath)) {
    logger.debug('Detected Cursor installation');
    return 'cursor';
  }

  // Check for VS Code
  const vscodePaths = getEditorPaths('vscode');
  if (await fs.pathExists(vscodePaths.configPath)) {
    logger.debug('Detected VS Code installation');
    return 'vscode';
  }

  logger.debug('No VS Code or Cursor installation detected');
  return null;
}

/**
 * Import editor settings to project
 */
export async function importEditorSettings(editorType: EditorType): Promise<void> {
  const config = getEditorPaths(editorType);

  logger.info(`Synced ${config.name} settings from local machine (host) to vscode-config folder for container mounting`);

  // Ensure project config directory exists
  await fs.ensureDir(projectConfigDir);

  // Import settings.json
  if (await fs.pathExists(config.settingsPath)) {
    const settings = await fs.readJson(config.settingsPath);
    await fs.writeJson(path.join(projectConfigDir, 'settings.json'), settings, { spaces: 2 });
    logger.debug('Imported settings.json');
  }

  // Import keybindings.json
  if (await fs.pathExists(config.keybindingsPath)) {
    const keybindings = await fs.readJson(config.keybindingsPath);
    await fs.writeJson(path.join(projectConfigDir, 'keybindings.json'), keybindings, { spaces: 2 });
    logger.debug('Imported keybindings.json');
  }

  // Import extensions list
  try {
    const { stdout } = await run(`${config.commandName} --list-extensions`);

    if (stdout) {
      const extensions = stdout.trim().split('\n').filter(Boolean);
      const extensionsPath = path.join(projectConfigDir, 'extensions.txt');
      await fs.writeFile(extensionsPath, extensions.join('\n'));
      logger.debug(`Imported ${extensions.length} extensions`);
    }
  } catch (error) {
    logger.debug('Extension fetch error:', error as Record<string, unknown>);
  }

  // Import snippets
  if (await fs.pathExists(config.snippetsPath)) {
    const snippetsDir = path.join(projectConfigDir, 'snippets');
    await fs.ensureDir(snippetsDir);
    await fs.copy(config.snippetsPath, snippetsDir, { overwrite: true });
    logger.debug('Imported user snippets');
  }

  logger.info(`Successfully synced ${config.name} configuration from host to vscode-config folder (mounted into container)`);
}
