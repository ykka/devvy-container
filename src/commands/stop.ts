import { CONSTANTS } from '@config/constants';
import * as compose from '@services/compose';
import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { Spinner } from '@utils/spinner';

export interface StopOptions {
  force?: boolean;
}

export async function stopCommand(options: StopOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;
    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (!containerInfo || containerInfo.state !== 'running') {
      logger.info('Container is not running');
      return;
    }

    if (!options.force) {
      const confirmed = await prompt.confirm('Are you sure you want to stop the development container?', true);

      if (!confirmed) {
        logger.info('Stop operation cancelled');
        return;
      }
    }

    const spinner = new Spinner('Stopping container...');
    spinner.start();

    try {
      await compose.composeDown();
      spinner.succeed('Container stopped successfully');
    } catch {
      try {
        await docker.stopContainer(containerName, true);
        spinner.succeed('Container force-stopped successfully');
      } catch {
        spinner.fail('Failed to stop container');
        process.exit(1);
      }
    }
  } catch (error) {
    logger.error('Failed to stop container', error);
    process.exit(1);
  }
}
