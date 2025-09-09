import * as os from 'node:os';
import * as path from 'node:path';
import { detectEditor, type EditorType, importEditorSettings } from '@services/vscode';
import { logger } from '@utils/logger';
import * as shell from '@utils/shell';
import * as fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

// Mock modules
vi.mock('fs-extra');
vi.mock('@utils/shell');
vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

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

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        return checkPath === cursorPath;
      });

      const result = await detectEditor();
      expect(result).toBe('cursor');
      expect(logger.debug).toHaveBeenCalledWith('Detected Cursor installation');
    });

    it('should detect VS Code when only VS Code config exists', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        return checkPath === vscodePath;
      });

      const result = await detectEditor();
      expect(result).toBe('vscode');
      expect(logger.debug).toHaveBeenCalledWith('Detected VS Code installation');
    });

    it('should return null when no editor is detected', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      const result = await detectEditor();
      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('No VS Code or Cursor installation detected');
    });

    it('should check Cursor before VS Code', async () => {
      const homedir = os.homedir();
      const cursorPath = path.join(homedir, 'Library', 'Application Support', 'Cursor');
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      vi.mocked(fs.pathExists).mockResolvedValue(true);

      const result = await detectEditor();
      expect(result).toBe('cursor');
      expect(fs.pathExists).toHaveBeenCalledWith(cursorPath);
      expect(fs.pathExists).not.toHaveBeenCalledWith(vscodePath);
    });
  });

  describe('importEditorSettings', () => {
    const mockSettingsContent = '{"editor.fontSize": 14}';
    const mockKeybindingsContent = '[{"key": "ctrl+k", "command": "workbench.action.terminal.clear"}]';
    const mockExtensionsOutput = 'ms-python.python\ndbaeumer.vscode-eslint\nesbenp.prettier-vscode';

    beforeEach(() => {
      vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('settings.json')) return mockSettingsContent;
          if (filePath.includes('keybindings.json')) return mockKeybindingsContent;
        }
        return '';
      });
      vi.mocked(fs.copy).mockResolvedValue(undefined);
    });

    it('should import VS Code settings successfully', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        if (typeof checkPath === 'string') {
          return checkPath === path.join(vscodePath, 'User', 'settings.json') || checkPath === path.join(vscodePath, 'User', 'keybindings.json');
        }
        return false;
      });

      vi.mocked(shell.run).mockResolvedValue({
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

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        if (typeof checkPath === 'string') {
          return checkPath === path.join(cursorPath, 'User', 'settings.json') || checkPath === path.join(cursorPath, 'User', 'keybindings.json');
        }
        return false;
      });

      vi.mocked(shell.run).mockResolvedValue({
        stdout: mockExtensionsOutput,
        stderr: '',
        code: 0,
      });

      await importEditorSettings('cursor');

      expect(shell.run).toHaveBeenCalledWith('cursor --list-extensions');
      expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Successfully imported'));
    });

    it('should handle missing settings file gracefully', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false);
      vi.mocked(shell.run).mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        code: 1,
      });

      await importEditorSettings('vscode');

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No VS Code configuration files were imported'));
    });

    it('should handle empty settings file', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        if (typeof checkPath === 'string') {
          return checkPath === path.join(vscodePath, 'User', 'settings.json');
        }
        return false;
      });

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce('') // First read (source file)
        .mockResolvedValueOnce(''); // Second read (verification)

      await importEditorSettings('vscode');

      expect(logger.warn).toHaveBeenCalledWith('Some files could not be imported:');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('settings.json was empty after copy'));
    });

    it('should import snippets directory when it exists', async () => {
      const homedir = os.homedir();
      const vscodePath = path.join(homedir, 'Library', 'Application Support', 'Code');
      const snippetsPath = path.join(vscodePath, 'User', 'snippets');

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        return checkPath === snippetsPath;
      });

      vi.mocked(shell.run).mockResolvedValue({
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

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        if (typeof checkPath === 'string') {
          return checkPath === path.join(vscodePath, 'User', 'settings.json');
        }
        return false;
      });

      vi.mocked(shell.run).mockResolvedValue({
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

      vi.mocked(fs.pathExists).mockImplementation(async (checkPath) => {
        if (typeof checkPath === 'string') {
          return checkPath === path.join(vscodePath, 'User', 'settings.json');
        }
        return false;
      });

      vi.mocked(shell.run).mockResolvedValue({
        stdout: '',
        stderr: '',
        code: 0,
      });

      await importEditorSettings('vscode');

      expect(fs.writeFile).toHaveBeenCalledWith(path.join(process.cwd(), 'vscode-config', 'settings.json'), mockSettingsContent);
    });

    it('should handle extension command failure', async () => {
      vi.mocked(fs.pathExists).mockResolvedValue(false);

      vi.mocked(shell.run).mockRejectedValue(new Error('Command failed'));

      await importEditorSettings('vscode');

      expect(logger.warn).toHaveBeenCalledWith('Some files could not be imported:');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch extensions'));
    });
  });
});
