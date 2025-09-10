import * as path from 'node:path';
import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import * as vscode from '@services/vscode';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { commandExists, run } from '@utils/shell';
import chalk from 'chalk';
import * as fs from 'fs-extra';

export interface EditorOptions {
  folder?: string;
}

async function selectRepository(containerName: string): Promise<string> {
  const reposDir = '/home/devvy/repos';

  // List directories in the repos folder
  logger.info('Checking available repositories...');
  const listCommand = `docker exec ${containerName} ls -d ${reposDir}/*/ 2>/dev/null | xargs -r -n1 basename`;
  const result = await run(listCommand, { silent: true });

  if (!result.success || !result.stdout.trim()) {
    logger.warn('No repositories found in /home/devvy/repos');
    logger.info('Opening in the repos directory...');
    return reposDir;
  }

  const repos = result.stdout.trim().split('\n').filter(Boolean);

  if (repos.length === 1) {
    const selectedRepo = `${reposDir}/${repos[0]}`;
    logger.info(`Found one repository: ${chalk.cyan(repos[0])}`);
    return selectedRepo;
  }

  // Add option to open repos directory itself
  const choices = [
    { name: '📁 Open repos directory (no specific project)', value: reposDir },
    ...repos.map((repo) => ({
      name: `📦 ${repo}`,
      value: `${reposDir}/${repo}`,
    })),
  ];

  const selected = await prompt.select('Which repository would you like to open?', choices);

  return selected;
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
    logger.info(`Regenerating devcontainer configuration from template...`);

    const containerUser = CONSTANTS.CONTAINER_USER_NAME;

    // Select repository if not provided
    const workspaceFolder = options.folder || (await selectRepository(containerName));

    // Check if extensions.txt exists
    const extensionsPath = path.join(process.cwd(), 'vscode-config', 'extensions.txt');
    if (!(await fs.pathExists(extensionsPath))) {
      logger.warn('No vscode-config/extensions.txt found.');
      logger.info(`Run ${chalk.cyan('devvy sync')} first to import your ${editorName} extensions.`);
    }

    // Create the attached container configuration with selected workspace
    const { path: configPath, extensionCount } = await vscode.createAttachedContainerConfig(
      editorType,
      workspaceFolder,
    );

    // Show verbose output
    logger.success(`✓ Regenerated devcontainer configuration from template`);
    logger.info(`  Location: ${chalk.dim(configPath)}`);
    logger.info(`  ${chalk.dim('(This file is regenerated each time to ensure latest settings)')}`);
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

    const command = `${editorCommand} --folder-uri "${containerUri}"`;
    logger.debug(`Executing: ${command}`);

    const result = await run(command);

    if (result.exitCode !== 0) {
      logger.error(`Failed to launch ${editorName} (exit code: ${result.exitCode})`);

      if (result.stderr) {
        logger.error(`Error output: ${result.stderr}`);
      }
      if (result.stdout) {
        logger.info(`Command output: ${result.stdout}`);
      }

      logger.info('\nTroubleshooting:');
      logger.info('1. Ensure Dev Containers extension is installed');
      logger.info(`2. Try manually: ${editorName} > Cmd+Shift+P > "Dev Containers: Attach to Running Container"`);
      logger.info(`3. Select "${containerName}" from the list`);
      logger.info(`4. Command attempted: ${command}`);
      process.exit(1);
    }

    logger.success(`✓ ${editorName} is attaching to the container as '${containerUser}' user`);
    logger.info('\nNote: It may take a moment for the connection to establish.');
  } catch (error) {
    logger.error('Failed to launch Cursor');
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      if (error.stack) {
        logger.debug(`Stack trace: ${error.stack}`);
      }
    } else {
      logger.error(`Error details: ${String(error)}`);
    }
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
    logger.info(`Regenerating devcontainer configuration from template...`);

    const containerUser = CONSTANTS.CONTAINER_USER_NAME;

    // Select repository if not provided
    const workspaceFolder = options.folder || (await selectRepository(containerName));

    // Check if extensions.txt exists
    const extensionsPath = path.join(process.cwd(), 'vscode-config', 'extensions.txt');
    if (!(await fs.pathExists(extensionsPath))) {
      logger.warn('No vscode-config/extensions.txt found.');
      logger.info(`Run ${chalk.cyan('devvy sync')} first to import your ${editorName} extensions.`);
    }

    // Create the attached container configuration with selected workspace
    const { path: configPath, extensionCount } = await vscode.createAttachedContainerConfig(
      editorType,
      workspaceFolder,
    );

    // Show verbose output
    logger.success(`✓ Regenerated devcontainer configuration from template`);
    logger.info(`  Location: ${chalk.dim(configPath)}`);
    logger.info(`  ${chalk.dim('(This file is regenerated each time to ensure latest settings)')}`);
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

    const command = `${editorCommand} --folder-uri "${containerUri}"`;
    logger.info(`Executing command: ${command}`);

    const result = await run(command, { silent: true });

    if (result.exitCode !== 0) {
      logger.error(`Failed to launch ${editorName} (exit code: ${result.exitCode})`);

      if (result.stderr) {
        logger.error(`Error output: ${result.stderr}`);
      }
      if (result.stdout) {
        logger.info(`Command output: ${result.stdout}`);
      }

      logger.info('\nTroubleshooting:');
      logger.info('1. Ensure Dev Containers extension is installed');
      logger.info(`2. Try manually: ${editorName} > Cmd+Shift+P > "Dev Containers: Attach to Running Container"`);
      logger.info(`3. Select "${containerName}" from the list`);
      logger.info(`4. Command attempted: ${command}`);
      process.exit(1);
    }

    logger.success(`✓ ${editorName} is attaching to the container as '${containerUser}' user`);
    logger.info('\nNote: It may take a moment for the connection to establish.');
  } catch (error) {
    logger.error('Failed to launch VS Code');
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      if (error.stack) {
        logger.debug(`Stack trace: ${error.stack}`);
      }
    } else {
      logger.error(`Error details: ${String(error)}`);
    }
    process.exit(1);
  }
}
