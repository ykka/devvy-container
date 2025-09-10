import * as os from 'node:os';
import * as path from 'node:path';

import { logger } from '@utils/logger';
import { run } from '@utils/shell';
import * as fs from 'fs-extra';

export type EditorType = 'vscode' | 'cursor';

export interface AttachedContainerConfig {
  workspaceFolder?: string;
  remoteUser?: string;
  settings?: Record<string, unknown>;
  extensions?: string[];
  forwardPorts?: number[];
  remoteEnv?: Record<string, string>;
  postAttachCommand?: string | string[];
  customizations?: {
    vscode?: {
      settings?: Record<string, unknown>;
      extensions?: string[];
    };
  };
}

// Module-level constants
const projectConfigDir = path.join(process.cwd(), 'vscode-config');

/**
 * Get the path to VS Code's attached container configuration
 */
function getAttachedContainerConfigPath(editorType: EditorType): string {
  const homeDir = os.homedir();
  const platform = process.platform;
  const configFilename = 'claude-devvy-container-devcontainer.json';

  const globalStorageDir =
    editorType === 'cursor'
      ? platform === 'darwin'
        ? path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage')
        : platform === 'win32'
          ? path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage')
          : path.join(homeDir, '.config', 'Cursor', 'User', 'globalStorage')
      : platform === 'darwin'
        ? path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage')
        : platform === 'win32'
          ? path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage')
          : path.join(homeDir, '.config', 'Code', 'User', 'globalStorage');

  // For Cursor, use anysphere.remote-containers, for VS Code use ms-vscode-remote.remote-containers
  const extensionId = editorType === 'cursor' ? 'anysphere.remote-containers' : 'ms-vscode-remote.remote-containers';
  return path.join(globalStorageDir, extensionId, 'imageConfigs', configFilename);
}

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
      extensionsPath:
        platform === 'darwin' ? path.join(homeDir, '.cursor', 'extensions') : path.join(basePath, 'extensions'),
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
    extensionsPath:
      platform === 'darwin' ? path.join(homeDir, '.vscode', 'extensions') : path.join(basePath, 'extensions'),
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
 * Prepare attached container configuration from template and extensions
 */
async function prepareAttachedContainerConfig(workspaceFolder?: string): Promise<AttachedContainerConfig> {
  const templatePath = path.join(
    process.cwd(),
    'templates',
    'devcontainer',
    'claude-devvy-container-devcontainer.json',
  );
  const extensionsPath = path.join(projectConfigDir, 'extensions.txt');

  // Read the template
  const template = await fs.readJson(templatePath);

  // Update workspace folder if provided
  if (workspaceFolder) {
    template.workspaceFolder = workspaceFolder;
    // Update postAttachCommand to cd into the workspace folder
    template.postAttachCommand = `cd ${workspaceFolder}`;
  }

  // Read extensions if available
  if (await fs.pathExists(extensionsPath)) {
    const extensionsContent = await fs.readFile(extensionsPath, 'utf-8');
    const extensions = extensionsContent.trim().split('\n').filter(Boolean);

    // Update the extensions in the template
    if (template.customizations?.vscode) {
      template.customizations.vscode.extensions = extensions;
    }

    logger.debug(`Loaded ${extensions.length} extensions from extensions.txt`);
  } else {
    logger.debug('No extensions.txt found, using empty extensions array');
  }

  return template;
}

/**
 * Create or update attached container configuration
 */
export async function createAttachedContainerConfig(
  editorType: EditorType,
  workspaceFolder?: string,
): Promise<{ path: string; extensionCount: number }> {
  const configPath = getAttachedContainerConfigPath(editorType);
  const configDir = path.dirname(configPath);

  logger.debug(`Creating attached container config at: ${configPath}`);

  // Ensure the directory exists
  await fs.ensureDir(configDir);

  // Prepare the configuration from template and extensions
  const config = await prepareAttachedContainerConfig(workspaceFolder);

  // Write the configuration
  await fs.writeJson(configPath, config, { spaces: 2 });

  logger.debug('Attached container configuration created successfully');

  const extensionCount = config.customizations?.vscode?.extensions?.length || 0;
  return { path: configPath, extensionCount };
}

/**
 * Read existing attached container configuration
 */
export async function readAttachedContainerConfig(editorType: EditorType): Promise<AttachedContainerConfig | null> {
  const configPath = getAttachedContainerConfigPath(editorType);

  if (await fs.pathExists(configPath)) {
    try {
      const config = await fs.readJson(configPath);
      logger.debug('Found existing attached container configuration');
      return config;
    } catch (error) {
      logger.debug('Failed to read attached container config:', error as Record<string, unknown>);
      return null;
    }
  }

  return null;
}

/**
 * Import editor settings to project
 */
export async function importEditorSettings(editorType: EditorType): Promise<void> {
  const config = getEditorPaths(editorType);

  logger.info(`Importing ${config.name} settings from local machine to vscode-config folder...`);

  // Ensure project config directory exists
  await fs.ensureDir(projectConfigDir);

  let filesImported = 0;
  const errors: string[] = [];

  // Import settings.json
  if (await fs.pathExists(config.settingsPath)) {
    try {
      const settingsContent = await fs.readFile(config.settingsPath, 'utf-8');
      const targetPath = path.join(projectConfigDir, 'settings.json');
      await fs.writeFile(targetPath, settingsContent);

      // Verify the file was written correctly
      const writtenContent = await fs.readFile(targetPath, 'utf-8');
      if (writtenContent.length > 0) {
        logger.debug(`Imported settings.json (${writtenContent.length} bytes)`);
        filesImported++;
      } else {
        errors.push('settings.json was empty after copy');
      }
    } catch (error) {
      errors.push(`Failed to import settings.json: ${error}`);
      logger.debug('Settings import error:', error as Record<string, unknown>);
    }
  } else {
    logger.debug(`Settings file not found at: ${config.settingsPath}`);
  }

  // Import keybindings.json
  if (await fs.pathExists(config.keybindingsPath)) {
    try {
      const keybindingsContent = await fs.readFile(config.keybindingsPath, 'utf-8');
      const targetPath = path.join(projectConfigDir, 'keybindings.json');
      await fs.writeFile(targetPath, keybindingsContent);

      // Verify the file was written correctly
      const writtenContent = await fs.readFile(targetPath, 'utf-8');
      if (writtenContent.length > 0) {
        logger.debug(`Imported keybindings.json (${writtenContent.length} bytes)`);
        filesImported++;
      } else {
        errors.push('keybindings.json was empty after copy');
      }
    } catch (error) {
      errors.push(`Failed to import keybindings.json: ${error}`);
      logger.debug('Keybindings import error:', error as Record<string, unknown>);
    }
  } else {
    logger.debug(`Keybindings file not found at: ${config.keybindingsPath}`);
  }

  // Import extensions list
  try {
    const { stdout } = await run(`${config.commandName} --list-extensions`);

    if (stdout?.trim()) {
      const extensions = stdout.trim().split('\n').filter(Boolean);
      const extensionsPath = path.join(projectConfigDir, 'extensions.txt');
      await fs.writeFile(extensionsPath, extensions.join('\n'));
      logger.debug(`Imported ${extensions.length} extensions`);
      filesImported++;
    } else {
      errors.push('No extensions found or command failed');
    }
  } catch (error) {
    errors.push(`Failed to fetch extensions: ${error}`);
    logger.debug('Extension fetch error:', error as Record<string, unknown>);
  }

  // Import snippets
  if (await fs.pathExists(config.snippetsPath)) {
    try {
      const snippetsDir = path.join(projectConfigDir, 'snippets');
      await fs.ensureDir(snippetsDir);
      await fs.copy(config.snippetsPath, snippetsDir, { overwrite: true });
      logger.debug('Imported user snippets');
      filesImported++;
    } catch (error) {
      errors.push(`Failed to import snippets: ${error}`);
      logger.debug('Snippets import error:', error as Record<string, unknown>);
    }
  } else {
    logger.debug(`Snippets directory not found at: ${config.snippetsPath}`);
  }

  if (filesImported > 0) {
    logger.success(`✓ Successfully imported ${filesImported} ${config.name} configuration files`);
  } else {
    logger.warn(`⚠️ No ${config.name} configuration files were imported`);
  }

  if (errors.length > 0) {
    logger.warn('Some files could not be imported:');
    for (const error of errors) {
      logger.warn(`  • ${error}`);
    }
  }
}
