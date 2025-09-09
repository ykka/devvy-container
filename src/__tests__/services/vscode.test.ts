import * as os from 'node:os';
import * as path from 'node:path';
import { detectEditor, importEditorSettings } from '@services/vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules - vi.mock is hoisted, so we define mocks inside factory functions
vi.mock('fs-extra', () => ({
  pathExists: vi.fn(),
  ensureDir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  copy: vi.fn(),
}));

vi.mock('@utils/shell', () => ({
  run: vi.fn(),
  exec: vi.fn(),
  commandExists: vi.fn(),
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    box: vi.fn(),
  },
}));

import { logger } from '@utils/logger';
import * as shell from '@utils/shell';
// Import mocked modules after vi.mock
import * as fs from 'fs-extra';

// Type assertions for mocked modules
const mockPathExists = fs.pathExists as any;
const mockEnsureDir = fs.ensureDir as any;
const mockWriteFile = fs.writeFile as any;
const mockReadFile = fs.readFile as any;
const mockCopy = fs.copy as any;
const mockRun = shell.run as any;

describe('VS Code Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default platform
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectEditor', () => {
    it('should detect Cursor when Cursor config exists', async () => {
      const homedir = os.homedir();
      const cursorPath = path.join(homedir, 'Library', 'Application Support', 'Cursor');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === cursorPath;
      });

      const result = await detectEditor();
      expect(result).toBe('cursor');
      expect(logger.debug).toHaveBeenCalledWith('Detected Cursor installation');
    });

    it('should detect VS Code when only VS Code config exists', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === vscodePath;
      });

      const result = await detectEditor();
      expect(result).toBe('vscode');
      expect(logger.debug).toHaveBeenCalledWith('Detected VS Code installation');
    });

    it('should return null when no editor is detected', async () => {
      mockPathExists.mockResolvedValue(false);

      const result = await detectEditor();
      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('No VS Code or Cursor installation detected');
    });

    it('should check Cursor before VS Code', async () => {
      const homedir = os.homedir();
      const cursorPath = path.join(homedir, 'Library', 'Application Support', 'Cursor');

      mockPathExists.mockResolvedValue(true);

      const result = await detectEditor();
      expect(result).toBe('cursor');
      expect(fs.pathExists).toHaveBeenCalledWith(cursorPath);
    });
  });

  describe('importEditorSettings', () => {
    const mockSettingsContent = '{"editor.fontSize": 14}';
    const mockKeybindingsContent = '[{"key": "ctrl+k", "command": "workbench.action.terminal.clear"}]';
    const mockExtensionsOutput = 'ms-python.python\ndbaeumer.vscode-eslint\nesbenp.prettier-vscode';

    beforeEach(() => {
      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('settings.json')) return mockSettingsContent;
        if (filePath.includes('keybindings.json')) return mockKeybindingsContent;
        return '';
      });
      mockCopy.mockResolvedValue(undefined);
    });

    it('should import VS Code settings successfully', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === path.join(vscodePath, 'User', 'settings.json') || checkPath === path.join(vscodePath, 'User', 'keybindings.json');
      });

      mockRun.mockResolvedValue({
        stdout: mockExtensionsOutput,
        stderr: '',
        code: 0,
      });

      await importEditorSettings('vscode');

      // Check that settings were imported
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(process.cwd(), 'vscode-config', 'settings.json'), mockSettingsContent);

      // Check that keybindings were imported
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(process.cwd(), 'vscode-config', 'keybindings.json'), mockKeybindingsContent);

      // Check that extensions were imported
      expect(fs.writeFile).toHaveBeenCalledWith(path.join(process.cwd(), 'vscode-config', 'extensions.txt'), mockExtensionsOutput.trim());

      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Successfully imported'));
    });

    it('should import Cursor settings successfully', async () => {
      const homedir = os.homedir();
      const cursorPath = path.join(homedir, 'Library', 'Application Support', 'Cursor');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === path.join(cursorPath, 'User', 'settings.json') || checkPath === path.join(cursorPath, 'User', 'keybindings.json');
      });

      mockRun.mockResolvedValue({
        stdout: mockExtensionsOutput,
        stderr: '',
        code: 0,
      });

      await importEditorSettings('cursor');

      expect(shell.run).toHaveBeenCalledWith('cursor --list-extensions');
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Successfully imported'));
    });

    it('should handle missing settings file gracefully', async () => {
      mockPathExists.mockResolvedValue(false);

      mockRun.mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        code: 1,
      });

      await importEditorSettings('vscode');

      // Should complete without errors
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No VS Code configuration files were imported'));
    });

    it('should handle empty settings file', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === path.join(vscodePath, 'User', 'settings.json');
      });

      mockReadFile
        .mockResolvedValueOnce('') // First read (source file)
        .mockResolvedValueOnce(''); // Second read (verification)

      await importEditorSettings('vscode');

      // Should complete but log warning about empty file
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Some files could not be imported:');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('settings.json was empty after copy'));
    });

    it('should import snippets directory when it exists', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');
      const snippetsPath = path.join(vscodePath, 'User', 'snippets');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === snippetsPath;
      });

      mockRun.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await importEditorSettings('vscode');

      expect(fs.copy).toHaveBeenCalledWith(snippetsPath, path.join(process.cwd(), 'vscode-config', 'snippets'), { overwrite: true });
    });

    it('should handle Windows paths correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'AppData', 'Roaming', 'Code');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === path.join(vscodePath, 'User', 'settings.json');
      });

      mockRun.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await importEditorSettings('vscode');

      expect(fs.writeFile).toHaveBeenCalledWith(path.join(process.cwd(), 'vscode-config', 'settings.json'), mockSettingsContent);
    });

    it('should handle Linux paths correctly', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      const homedir = os.homedir();
      const vscodePath = path.join(homedir, '.config', 'Code');

      mockPathExists.mockImplementation(async (checkPath: string) => {
        return checkPath === path.join(vscodePath, 'User', 'settings.json');
      });

      mockRun.mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await importEditorSettings('vscode');

      expect(fs.writeFile).toHaveBeenCalledWith(path.join(process.cwd(), 'vscode-config', 'settings.json'), mockSettingsContent);
    });

    it('should handle extension command failure', async () => {
      mockPathExists.mockResolvedValue(false);

      mockRun.mockRejectedValue(new Error('Command failed'));

      await importEditorSettings('vscode');

      // Should complete without throwing
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Some files could not be imported:');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch extensions'));
    });
  });
});
