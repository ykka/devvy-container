import * as os from 'node:os';
import * as path from 'node:path';

import { logger } from '@utils/logger';
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
 * Get editor configuration path for detection
 */
function getEditorConfigPath(type: EditorType): string {
  const homeDir = os.homedir();
  const platform = process.platform;

  if (type === 'cursor') {
    return platform === 'darwin'
      ? path.join(homeDir, 'Library', 'Application Support', 'Cursor')
      : platform === 'win32'
        ? path.join(homeDir, 'AppData', 'Roaming', 'Cursor')
        : path.join(homeDir, '.config', 'Cursor');
  }

  // VS Code path
  return platform === 'darwin'
    ? path.join(homeDir, 'Library', 'Application Support', 'Code')
    : platform === 'win32'
      ? path.join(homeDir, 'AppData', 'Roaming', 'Code')
      : path.join(homeDir, '.config', 'Code');
}

/**
 * Detect installed editor
 */
export async function detectEditor(): Promise<EditorType | null> {
  // Check for Cursor first (since it's a fork of VS Code)
  const cursorPath = getEditorConfigPath('cursor');
  if (await fs.pathExists(cursorPath)) {
    logger.debug('Detected Cursor installation');
    return 'cursor';
  }

  // Check for VS Code
  const vscodePath = getEditorConfigPath('vscode');
  if (await fs.pathExists(vscodePath)) {
    logger.debug('Detected VS Code installation');
    return 'vscode';
  }

  logger.debug('No VS Code or Cursor installation detected');
  return null;
}

/**
 * Prepare attached container configuration from template
 */
async function prepareAttachedContainerConfig(workspaceFolder?: string): Promise<AttachedContainerConfig> {
  const templatePath = path.join(
    process.cwd(),
    'templates',
    'devcontainer',
    'claude-devvy-container-devcontainer.json',
  );

  // Read the template
  const template = await fs.readJson(templatePath);

  // Update workspace folder if provided
  if (workspaceFolder) {
    template.workspaceFolder = workspaceFolder;
    // Update postAttachCommand to cd into the workspace folder
    template.postAttachCommand = `cd ${workspaceFolder}`;
  }

  return template;
}

/**
 * Create or update attached container configuration
 */
export async function createAttachedContainerConfig(
  editorType: EditorType,
  workspaceFolder?: string,
): Promise<{ path: string }> {
  const configPath = getAttachedContainerConfigPath(editorType);
  const configDir = path.dirname(configPath);

  logger.debug(`Creating attached container config at: ${configPath}`);

  // Ensure the directory exists
  await fs.ensureDir(configDir);

  // Prepare the configuration from template
  const config = await prepareAttachedContainerConfig(workspaceFolder);

  // Write the configuration
  await fs.writeJson(configPath, config, { spaces: 2 });

  logger.debug('Attached container configuration created successfully');

  return { path: configPath };
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
