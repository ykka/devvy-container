import * as os from 'node:os';
import * as path from 'node:path';

import { logger } from '@utils/logger';
import { run } from '@utils/shell';
import * as fs from 'fs-extra';

export type EditorType = 'vscode' | 'cursor';

export interface EditorConfig {
  type: EditorType;
  name: string;
  configPath: string;
  settingsPath: string;
  keybindingsPath: string;
  extensionsPath: string;
  snippetsPath: string;
  commandName: string;
}

export interface ExtensionInfo {
  id: string;
  version?: string;
}

export class VSCodeService {
  private static instance: VSCodeService;
  private projectConfigDir: string;

  private constructor() {
    this.projectConfigDir = path.join(process.cwd(), 'vscode-config');
  }

  public static getInstance(): VSCodeService {
    if (!VSCodeService.instance) {
      VSCodeService.instance = new VSCodeService();
    }
    return VSCodeService.instance;
  }

  private getEditorPaths(type: EditorType): EditorConfig {
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

  public async detectEditor(): Promise<EditorType | null> {
    // Check for Cursor first (since it's a fork of VS Code)
    const cursorPaths = this.getEditorPaths('cursor');
    if (await fs.pathExists(cursorPaths.configPath)) {
      logger.debug('Detected Cursor installation');
      return 'cursor';
    }

    // Check for VS Code
    const vscodePaths = this.getEditorPaths('vscode');
    if (await fs.pathExists(vscodePaths.configPath)) {
      logger.debug('Detected VS Code installation');
      return 'vscode';
    }

    logger.debug('No VS Code or Cursor installation detected');
    return null;
  }

  public async importSettings(editorType: EditorType): Promise<void> {
    const config = this.getEditorPaths(editorType);

    // Ensure project config directory exists
    await fs.ensureDir(this.projectConfigDir);

    // Import settings.json
    if (await fs.pathExists(config.settingsPath)) {
      const settings = await fs.readJson(config.settingsPath);
      await fs.writeJson(path.join(this.projectConfigDir, 'settings.json'), settings, { spaces: 2 });
    }

    // Import keybindings.json
    if (await fs.pathExists(config.keybindingsPath)) {
      const keybindings = await fs.readJson(config.keybindingsPath);
      await fs.writeJson(path.join(this.projectConfigDir, 'keybindings.json'), keybindings, { spaces: 2 });
    }

    // Import extensions list
    await this.importExtensions(editorType);

    // Import snippets
    if (await fs.pathExists(config.snippetsPath)) {
      const snippetsDir = path.join(this.projectConfigDir, 'snippets');
      await fs.ensureDir(snippetsDir);
      await fs.copy(config.snippetsPath, snippetsDir, { overwrite: true });
    }
  }

  public async importExtensions(editorType: EditorType): Promise<void> {
    const config = this.getEditorPaths(editorType);

    try {
      const { stdout } = await run(`${config.commandName} --list-extensions`);

      if (stdout) {
        const extensions = stdout.trim().split('\n').filter(Boolean);
        const extensionsPath = path.join(this.projectConfigDir, 'extensions.txt');
        await fs.writeFile(extensionsPath, extensions.join('\n'));
      }
    } catch (error) {
      logger.debug('Extension fetch error:', error as Record<string, unknown>);
    }
  }

  public async syncToProject(editorType: EditorType): Promise<void> {
    logger.info(`Syncing from ${this.getEditorPaths(editorType).name} to project...`);
    await this.importSettings(editorType);
  }

  public async ensureProjectConfig(): Promise<void> {
    await fs.ensureDir(this.projectConfigDir);

    // Create default files if they don't exist
    const settingsPath = path.join(this.projectConfigDir, 'settings.json');
    if (!(await fs.pathExists(settingsPath))) {
      await fs.writeJson(settingsPath, {}, { spaces: 2 });
    }

    const keybindingsPath = path.join(this.projectConfigDir, 'keybindings.json');
    if (!(await fs.pathExists(keybindingsPath))) {
      await fs.writeJson(keybindingsPath, [], { spaces: 2 });
    }

    const extensionsPath = path.join(this.projectConfigDir, 'extensions.txt');
    if (!(await fs.pathExists(extensionsPath))) {
      await fs.writeFile(extensionsPath, '');
    }
  }

  public getProjectConfigPath(): string {
    return this.projectConfigDir;
  }
}
