import type { EditorType } from '@services/vscode';
import * as vscode from '@services/vscode';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { Spinner } from '@utils/spinner';

export interface SyncOptions {
  editor?: string;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  try {
    // Project config directory is automatically created when importing settings

    // Detect or select editor
    let editorType: EditorType | null = null;

    if (options.editor) {
      // User specified editor
      const editorLower = options.editor.toLowerCase();
      if (editorLower === 'vscode' || editorLower === 'code') {
        editorType = 'vscode';
      } else if (editorLower === 'cursor') {
        editorType = 'cursor';
      } else {
        logger.error(`Unknown editor: ${options.editor}`);
        logger.info('Supported editors: vscode, cursor');
        process.exit(1);
      }
    } else {
      // Auto-detect editor
      editorType = await vscode.detectEditor();

      if (!editorType) {
        // No editor detected, ask user
        const choice = await prompt.select('No editor detected. Which editor are you using?', [
          { name: 'VS Code', value: 'vscode' },
          { name: 'Cursor', value: 'cursor' },
        ]);
        editorType = choice as EditorType;
      }
    }

    const editorName = editorType === 'cursor' ? 'Cursor' : 'VS Code';

    // Always import from editor to project (one-way sync)

    // Confirm action
    const confirmed = await prompt.confirm(
      `Import settings from ${editorName} to claude-devvy-container project for use inside the container?`,
      true,
    );

    if (!confirmed) {
      logger.info('Sync cancelled');
      return;
    }

    // Perform sync
    const spinner = new Spinner(`Importing ${editorName} settings...`);
    spinner.start();

    try {
      await vscode.importEditorSettings(editorType);

      spinner.succeed(`Successfully imported ${editorName} settings to claude-devvy-container project`);

      // Show what was synced
      logger.info('');
      logger.info('Synced items to vscode-config/:');
      logger.step('settings.json - Editor preferences');
      logger.step('keybindings.json - Keyboard shortcuts');
      logger.step('extensions.txt - Extension list (will be used when connecting to container)');
      logger.step('snippets/ - Code snippets');

      logger.info('');
      logger.info(`Run 'devvy ${editorType}' to connect ${editorName} to the container with these settings.`);
    } catch (error) {
      spinner.fail(`Failed to sync ${editorName} settings`);
      throw error;
    }
  } catch (error) {
    logger.error('Sync failed', error);
    process.exit(1);
  }
}

export async function syncCursorSettings(): Promise<void> {
  await syncCommand({ editor: 'cursor' });
}

export async function syncVSCodeSettings(): Promise<void> {
  await syncCommand({ editor: 'vscode' });
}
