import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import { execInteractive } from '@utils/shell';

export interface ConnectAsRootOptions {
  tmux?: boolean;
}

export async function connectAsRootCommand(options: ConnectAsRootOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;
    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (!containerInfo || containerInfo.state !== 'running') {
      logger.error('Container is not running. Please start it first with: devvy start');
      process.exit(1);
    }

    logger.info('Connecting to container as root via Docker exec...');
    logger.warn('⚠️  You are connecting as root user. Use with caution!');

    const command = 'docker';
    const args = ['exec', '-it', containerName];

    if (options.tmux) {
      args.push('tmux', 'new-session', '-A', '-s', 'main');
    } else {
      args.push('bash');
    }

    logger.command(`${command} ${args.join(' ')}`);

    const exitCode = await execInteractive(command, args);

    if (exitCode !== 0) {
      logger.error(`Connection failed with exit code: ${exitCode}`);
      logger.info('\nTroubleshooting tips:');
      logger.info('1. Ensure the container is running: devvy status');
      logger.info('2. Try rebuilding the container: devvy rebuild');
      process.exit(exitCode);
    }
  } catch (error) {
    logger.error('Failed to connect to container as root', error);
    process.exit(1);
  }
}
