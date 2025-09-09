import { CONSTANTS } from '@config/constants';
import { validateEnvironment } from '@config/environment';
import * as docker from '@services/docker';
import * as ssh from '@services/ssh';
import { logger } from '@utils/logger';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';

export interface StartOptions {
  build?: boolean;
  detach?: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  try {
    // Validate environment before starting
    const validation = await validateEnvironment();
    if (!validation.valid) {
      logger.error('Environment validation failed:');
      for (const error of validation.errors) {
        logger.error(`  - ${error}`);
      }
      process.exit(1);
    }

    const spinner = Spinner.createProgressSpinner([
      'Checking Docker daemon...',
      'Validating configuration...',
      'Checking container status...',
      'Managing SSH keys...',
      options.build ? 'Building Docker image...' : 'Starting container...',
      'Setting up SSH access...',
      'Verifying container health...',
      'Container started successfully',
    ]);

    const isDockerRunning = await docker.isDockerRunning();
    if (!isDockerRunning) {
      spinner.fail('Docker daemon is not running. Please start Docker first.');
      process.exit(1);
    }
    spinner.next();

    // Validation step
    spinner.next();

    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;
    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (containerInfo && containerInfo.state === 'running') {
      spinner.complete();
      logger.info('Container is already running');

      logger.info(`SSH: ssh -p ${CONSTANTS.SSH.PORT} ${CONSTANTS.CONTAINER_USER_NAME}@localhost`);
      return;
    }
    spinner.next();

    await ssh.removeContainerSSHKeyFromHostKnownHosts('localhost', CONSTANTS.SSH.PORT);
    spinner.next();

    try {
      await docker.composeUp(options.detach !== false, options.build || false);
    } catch {
      spinner.fail('Failed to start container');
      process.exit(1);
    }
    spinner.next();

    await ssh.addContainerSSHKeyToHostKnownHosts('localhost', CONSTANTS.SSH.PORT);
    spinner.next();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newContainerInfo = await docker.getContainerInfo(containerName).catch(() => null);
    if (!newContainerInfo || newContainerInfo.state !== 'running') {
      spinner.fail('Container failed to start properly');
      process.exit(1);
    }

    spinner.complete();

    logger.success('Container started successfully');

    logger.info(`\nConnect with: ${chalk.cyan(`devvy connect`)}`);
    logger.info(`Or use SSH: ${chalk.cyan(`ssh -p ${CONSTANTS.SSH.PORT} ${CONSTANTS.CONTAINER_USER_NAME}@localhost`)}`);
  } catch (error) {
    logger.error('Failed to start container', error);
    process.exit(1);
  }
}
