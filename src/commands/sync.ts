import { type EditorType, VSCodeService } from '@services/vscode.service';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';

export interface SyncOptions {
  import?: boolean;
  export?: boolean;
  editor?: string;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const vscodeService = VSCodeService.getInstance();

  try {
    // Ensure project config directory exists
    await vscodeService.ensureProjectConfig();

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
      editorType = await vscodeService.detectEditor();

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

    // Determine sync direction
    let syncDirection: 'import' | 'export' | null = null;

    if (options.import && options.export) {
      logger.error('Cannot specify both --import and --export');
      process.exit(1);
    } else if (options.import) {
      syncDirection = 'import';
    } else if (options.export) {
      syncDirection = 'export';
    } else {
      // Ask user for direction
      const choice = await prompt.select('Which direction do you want to sync?', [
        {
          name: `Import from ${editorName} to project`,
          value: 'import',
        },
        {
          name: `Export from project to ${editorName}`,
          value: 'export',
        },
      ]);
      syncDirection = choice as 'import' | 'export';
    }

    // Confirm action
    const action = syncDirection === 'import' ? `import settings from ${editorName} to the project` : `export project settings to ${editorName}`;

    const warning = syncDirection === 'export' ? chalk.yellow('\n⚠️  This will overwrite your current editor settings!') : '';

    const confirmed = await prompt.confirm(`Are you sure you want to ${action}?${warning}`, true);

    if (!confirmed) {
      logger.info('Sync cancelled');
      return;
    }

    // Perform sync
    const spinner = new Spinner(syncDirection === 'import' ? `Importing ${editorName} settings...` : `Exporting settings to ${editorName}...`);
    spinner.start();

    try {
      await (syncDirection === 'import' ? vscodeService.syncToProject(editorType) : vscodeService.syncFromProject(editorType));

      spinner.succeed(
        syncDirection === 'import' ? `Successfully imported ${editorName} settings to project` : `Successfully exported project settings to ${editorName}`,
      );

      // Show what was synced
      logger.info('');
      logger.info('Synced items:');
      logger.step('settings.json - Editor preferences');
      logger.step('keybindings.json - Keyboard shortcuts');
      logger.step('extensions.txt - Extension list');
      logger.step('snippets/ - Code snippets');

      if (syncDirection === 'export') {
        logger.info('');
        logger.info(chalk.cyan('Note: You may need to restart your editor for all changes to take effect'));
      }
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
  await syncCommand({ import: true, editor: 'cursor' });
}

export async function syncVSCodeSettings(): Promise<void> {
  await syncCommand({ import: true, editor: 'vscode' });
}
