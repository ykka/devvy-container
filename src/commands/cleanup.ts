import * as path from 'node:path';

import { ConfigService } from '@services/config.service';
import { SSHService } from '@services/ssh.service';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { run } from '@utils/shell';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';
import * as fs from 'fs-extra';

export interface CleanupOptions {
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

interface CleanupAction {
  name: string;
  description: string;
  action: () => Promise<void>;
  sizeEstimate?: string;
}

export async function cleanupCommand(options: CleanupOptions): Promise<void> {
  const config = ConfigService.getInstance();
  const sshService = SSHService.getInstance();

  logger.info(chalk.bold.cyan('Devvy Environment Cleanup'));
  logger.info(chalk.cyan('===================================='));
  logger.info('');

  if (options.all && !options.dryRun) {
    if (!options.force) {
      const confirmed = await prompt.confirm(chalk.red.bold('WARNING: This will remove EVERYTHING. Are you sure?'), false);
      if (!confirmed) {
        logger.info('Cleanup cancelled');
        return;
      }
    }
    await performFullCleanup();
    return;
  }

  const containerName = config.getDockerConfig().containerName;
  const imageName = `claude-devvy-container_${containerName}`;

  const cleanupActions: CleanupAction[] = [
    {
      name: 'Container and Image',
      description: 'Remove development container and Docker image',
      sizeEstimate: await getDockerResourceSize(containerName, imageName),
      action: async () => {
        const spinner = new Spinner('Removing container and image...');
        spinner.start();

        try {
          await run(`docker compose down 2>/dev/null || true`);
          await run(`docker rm -f ${containerName} 2>/dev/null || true`);
          await run(`docker rmi ${imageName} 2>/dev/null || true`);
          spinner.succeed('Container and image removed');
        } catch (error) {
          spinner.fail('Failed to remove container/image');
          throw error;
        }
      },
    },
    {
      name: 'Docker Volumes',
      description: 'Remove Docker volumes (nvim, npm cache, etc)',
      sizeEstimate: await getVolumeSize(),
      action: async () => {
        const spinner = new Spinner('Removing Docker volumes...');
        spinner.start();

        const volumes = ['nvim-data', 'zsh-history', 'npm-cache', 'pnpm-store', 'claude-code-data', 'vscode-server'];

        for (const vol of volumes) {
          try {
            await run(`docker volume rm "claude-devvy-container_${vol}" 2>/dev/null || true`);
          } catch {
            // Ignore errors for non-existent volumes
          }
        }
        spinner.succeed('Volumes removed');
      },
    },
    {
      name: 'VS Code/Cursor Settings',
      description: 'Reset VS Code/Cursor settings to defaults',
      action: async () => {
        const spinner = new Spinner('Resetting VS Code settings...');
        spinner.start();

        const vscodeConfigDir = path.join(process.cwd(), 'vscode-config');
        if (await fs.pathExists(vscodeConfigDir)) {
          await fs.writeJson(path.join(vscodeConfigDir, 'settings.json'), {});
          await fs.writeJson(path.join(vscodeConfigDir, 'keybindings.json'), []);
          await fs.writeFile(path.join(vscodeConfigDir, 'extensions.txt'), '');
          spinner.succeed('VS Code settings reset to defaults');
        } else {
          spinner.info('No VS Code config directory found');
        }
      },
    },
    {
      name: 'SSH Keys and Secrets',
      description: 'Remove SSH keys and secrets directory',
      action: async () => {
        const spinner = new Spinner('Removing SSH keys and secrets...');
        spinner.start();

        await sshService.cleanupHostSSHKeys();

        const secretsDir = path.join(process.cwd(), 'secrets');
        if (await fs.pathExists(secretsDir)) {
          await fs.remove(secretsDir);
        }

        spinner.succeed('SSH keys and secrets removed');
      },
    },
    {
      name: 'Environment and Config Files',
      description: 'Remove .env and devvy.config.json files',
      action: async () => {
        const spinner = new Spinner('Removing environment and config files...');
        spinner.start();

        const configFiles = ['.env', 'devvy.config.json'];
        for (const file of configFiles) {
          const filePath = path.join(process.cwd(), file);
          if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
          }
        }

        spinner.succeed('Environment and config files removed');
      },
    },
  ];

  if (options.dryRun) {
    logger.info(chalk.yellow('DRY RUN MODE - Nothing will be removed'));
    logger.info('');
    logger.info('The following would be cleaned up:');
    for (const action of cleanupActions) {
      logger.step(`${action.name}: ${action.description}`);
      if (action.sizeEstimate) {
        logger.info(`  Size: ${action.sizeEstimate}`);
      }
    }
    return;
  }

  logger.info(chalk.bold('What would you like to clean up?'));
  logger.info('');

  const selectedActions: CleanupAction[] = [];

  for (const [i, cleanupAction] of cleanupActions.entries()) {
    const action = cleanupAction;
    const question = `${i + 1}. ${action.description}${action.sizeEstimate ? ` (${action.sizeEstimate})` : ''}?`;

    const confirmed = await prompt.confirm(question, false);
    if (confirmed) {
      selectedActions.push(action);
    }
  }

  logger.info('');
  logger.info(chalk.gray('──────────────────────────────────'));

  const fullReset = await prompt.confirm(chalk.red.bold('WARNING: FULL RESET - Remove everything?'), false);

  if (fullReset) {
    await performFullCleanup();
    return;
  }

  if (selectedActions.length === 0) {
    logger.info('No cleanup actions selected');
    return;
  }

  logger.info('');
  for (const action of selectedActions) {
    await action.action();
  }

  logger.info('');
  logger.info(chalk.green('═══════════════════════════════════════════════════════════'));
  logger.success('Cleanup complete!');
  logger.info('');
  logger.info('To rebuild the environment, run:');
  logger.info(chalk.cyan('  devvy setup'));
  logger.info(chalk.green('═══════════════════════════════════════════════════════════'));
}

async function performFullCleanup(): Promise<void> {
  const spinner = new Spinner('Performing full cleanup...');
  spinner.start();

  try {
    await run('docker compose down -v 2>/dev/null || true');
    await run('docker rm -f claude-devvy-container 2>/dev/null || true');
    await run('docker rmi claude-devvy-container_devcontainer 2>/dev/null || true');

    const sshService = SSHService.getInstance();
    await sshService.cleanupHostSSHKeys();

    const dirsToRemove = ['secrets'];
    for (const dir of dirsToRemove) {
      const dirPath = path.join(process.cwd(), dir);
      if (await fs.pathExists(dirPath)) {
        await fs.remove(dirPath);
      }
    }

    const filesToRemove = ['.env', 'devvy.config.json'];
    for (const file of filesToRemove) {
      const filePath = path.join(process.cwd(), file);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
    }

    const vscodeConfigDir = path.join(process.cwd(), 'vscode-config');
    if (await fs.pathExists(vscodeConfigDir)) {
      await fs.writeJson(path.join(vscodeConfigDir, 'settings.json'), {});
      await fs.writeJson(path.join(vscodeConfigDir, 'keybindings.json'), []);
      await fs.writeFile(path.join(vscodeConfigDir, 'extensions.txt'), '');
    }

    spinner.succeed('Full cleanup complete!');
  } catch (error) {
    spinner.fail('Full cleanup failed');
    throw error;
  }
}

async function getDockerResourceSize(containerName: string, imageName: string): Promise<string> {
  try {
    const { stdout: containerSize } = await run(`docker ps -a --filter name=${containerName} --format "table {{.Size}}" | tail -n +2`, { silent: true });

    const { stdout: imageSize } = await run(`docker images ${imageName} --format "{{.Size}}" 2>/dev/null || echo "0B"`, { silent: true });

    const sizes = [];
    if (containerSize?.trim()) sizes.push(containerSize.trim());
    if (imageSize && imageSize.trim() !== '0B') sizes.push(imageSize.trim());

    return sizes.length > 0 ? sizes.join(' + ') : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function getVolumeSize(): Promise<string> {
  try {
    const { stdout } = await run(`docker system df -v | grep claude-devvy-container | awk '{sum+=$4} END {print sum}'`, { silent: true });

    if (stdout?.trim()) {
      const sizeInBytes = Number.parseInt(stdout.trim(), 10);
      if (!Number.isNaN(sizeInBytes)) {
        return formatBytes(sizeInBytes);
      }
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
