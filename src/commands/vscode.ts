import * as path from 'node:path';
import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import * as vscode from '@services/vscode';
import { logger } from '@utils/logger';
import { commandExists, run } from '@utils/shell';
import chalk from 'chalk';
import * as fs from 'fs-extra';

export interface EditorOptions {
  folder?: string;
}

export async function cursorCommand(options: EditorOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;
    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (!containerInfo || containerInfo.state !== 'running') {
      logger.error('Container is not running. Please start it first with: devvy start');
      process.exit(1);
    }

    // Use Cursor
    const editorType: vscode.EditorType = 'cursor';
    const editorCommand = 'cursor';
    const editorName = 'Cursor';

    // Check if the editor is installed
    if (!(await commandExists(editorCommand))) {
      logger.error(`${editorName} command line tools are not installed.`);
      logger.info('Install Cursor from: https://cursor.sh');
      logger.info('Then install the command line tools from Cursor > Install "cursor" command');
      process.exit(1);
    }

    // Create or update the attached container configuration
    logger.info(`Configuring ${editorName} to connect as 'devvy' user...`);

    const containerUser = CONSTANTS.CONTAINER_USER_NAME;
    const workspaceFolder = options.folder || `/home/${containerUser}`;

    // Check if extensions.txt exists
    const extensionsPath = path.join(process.cwd(), 'vscode-config', 'extensions.txt');
    if (!(await fs.pathExists(extensionsPath))) {
      logger.warn('No vscode-config/extensions.txt found.');
      logger.info(`Run ${chalk.cyan('devvy sync')} first to import your ${editorName} extensions.`);
    }

    // Create the attached container configuration
    const { path: configPath, extensionCount } = await vscode.createAttachedContainerConfig(editorType);

    // Show verbose output
    logger.success(`✓ Created devcontainer configuration at:`);
    logger.info(`  ${chalk.dim(configPath)}`);
    if (extensionCount > 0) {
      logger.success(`✓ Included ${extensionCount} extensions from vscode-config/extensions.txt`);
    }
    logger.success(`✓ Configured to connect as user: ${chalk.cyan(containerUser)}`);
    logger.success(`✓ Workspace folder: ${chalk.cyan(workspaceFolder)}`);

    // Launch Cursor and attach to the container
    logger.info('');
    logger.info(`Launching ${editorName} and attaching to container...`);

    // Use the Dev Containers extension command to attach
    // The --folder-uri parameter specifies the container and folder to open
    const containerUri = `vscode-remote://attached-container+${Buffer.from(containerName).toString('hex')}${workspaceFolder}`;

    const { exitCode } = await run(`${editorCommand} --folder-uri "${containerUri}"`);

    if (exitCode !== 0) {
      logger.error(`Failed to launch ${editorName}`);
      logger.info('\nTroubleshooting:');
      logger.info('1. Ensure Dev Containers extension is installed');
      logger.info(`2. Try manually: ${editorName} > Cmd+Shift+P > "Dev Containers: Attach to Running Container"`);
      logger.info(`3. Select "${containerName}" from the list`);
      process.exit(1);
    }

    logger.success(`✓ ${editorName} is attaching to the container as '${containerUser}' user`);
    logger.info('\nNote: It may take a moment for the connection to establish.');
  } catch (error) {
    logger.error('Failed to launch Cursor', error);
    process.exit(1);
  }
}

export async function vscodeCommand(options: EditorOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;
    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (!containerInfo || containerInfo.state !== 'running') {
      logger.error('Container is not running. Please start it first with: devvy start');
      process.exit(1);
    }

    // Use VS Code
    const editorType: vscode.EditorType = 'vscode';
    const editorCommand = 'code';
    const editorName = 'VS Code';

    // Check if the editor is installed
    if (!(await commandExists(editorCommand))) {
      logger.error(`${editorName} command line tools are not installed.`);
      logger.info('Install VS Code from: https://code.visualstudio.com');
      logger.info(
        'Then install the command line tools: Cmd+Shift+P > "Shell Command: Install \'code\' command in PATH"',
      );
      process.exit(1);
    }

    // Create or update the attached container configuration
    logger.info(`Configuring ${editorName} to connect as 'devvy' user...`);

    const containerUser = CONSTANTS.CONTAINER_USER_NAME;
    const workspaceFolder = options.folder || `/home/${containerUser}`;

    // Check if extensions.txt exists
    const extensionsPath = path.join(process.cwd(), 'vscode-config', 'extensions.txt');
    if (!(await fs.pathExists(extensionsPath))) {
      logger.warn('No vscode-config/extensions.txt found.');
      logger.info(`Run ${chalk.cyan('devvy sync')} first to import your ${editorName} extensions.`);
    }

    // Create the attached container configuration
    const { path: configPath, extensionCount } = await vscode.createAttachedContainerConfig(editorType);

    // Show verbose output
    logger.success(`✓ Created devcontainer configuration at:`);
    logger.info(`  ${chalk.dim(configPath)}`);
    if (extensionCount > 0) {
      logger.success(`✓ Included ${extensionCount} extensions from vscode-config/extensions.txt`);
    }
    logger.success(`✓ Configured to connect as user: ${chalk.cyan(containerUser)}`);
    logger.success(`✓ Workspace folder: ${chalk.cyan(workspaceFolder)}`);

    // Launch VS Code and attach to the container
    logger.info('');
    logger.info(`Launching ${editorName} and attaching to container...`);

    // Use the Dev Containers extension command to attach
    // The --folder-uri parameter specifies the container and folder to open
    const containerUri = `vscode-remote://attached-container+${Buffer.from(containerName).toString('hex')}${workspaceFolder}`;

    const { exitCode } = await run(`${editorCommand} --folder-uri "${containerUri}"`);

    if (exitCode !== 0) {
      logger.error(`Failed to launch ${editorName}`);
      logger.info('\nTroubleshooting:');
      logger.info('1. Ensure Dev Containers extension is installed');
      logger.info(`2. Try manually: ${editorName} > Cmd+Shift+P > "Dev Containers: Attach to Running Container"`);
      logger.info(`3. Select "${containerName}" from the list`);
      process.exit(1);
    }

    logger.success(`✓ ${editorName} is attaching to the container as '${containerUser}' user`);
    logger.info('\nNote: It may take a moment for the connection to establish.');
  } catch (error) {
    logger.error('Failed to launch VS Code', error);
    process.exit(1);
  }
}
