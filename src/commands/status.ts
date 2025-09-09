import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import chalk from 'chalk';

export interface StatusOptions {
  json?: boolean;
  verbose?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;

    const isDockerRunning = await docker.isDockerRunning();
    if (!isDockerRunning) {
      if (options.json) {
        process.stdout.write(`${JSON.stringify({ status: 'docker-not-running' }, null, 2)}\n`);
      } else {
        logger.error('Docker daemon is not running');
      }
      process.exit(1);
    }

    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(containerInfo, null, 2)}\n`);
      return;
    }

    if (!containerInfo) {
      logger.warn(`Container '${containerName}' does not exist`);
      return;
    }

    if (containerInfo.state === 'running') {
      logger.info(`Container is ${chalk.green('running')} (${getUptime(containerInfo.created)})`);
    } else {
      logger.info(`Container is ${chalk.red('stopped')}`);
    }
  } catch (error) {
    logger.error('Failed to get container status', error);
    process.exit(1);
  }
}

function getUptime(created: string): string {
  const startTime = new Date(created).getTime();
  const now = Date.now();
  const uptimeMs = now - startTime;

  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : 'Just started';
}
