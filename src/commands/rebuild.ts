import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import * as ssh from '@services/ssh';
import { logger } from '@utils/logger';
import * as prompt from '@utils/prompt';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';

interface RebuildOptions {
  noCache?: boolean;
  force?: boolean;
}

export async function rebuildCommand(options: RebuildOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;

    // Check if container is running
    const isRunning = await docker.isContainerRunning(containerName);

    if (isRunning && !options.force) {
      const shouldStop = await prompt.confirm('Container is running. Stop it before rebuilding?', true);
      if (!shouldStop) {
        logger.info('Rebuild cancelled');
        return;
      }
    }

    // Check if GitHub SSH keys exist and skip regeneration
    const githubKeyExists = await ssh.gitHubSSHKeyExists();
    if (githubKeyExists) {
      const githubKeyPath = ssh.getGitHubSSHKeyPath();
      logger.info(
        `\n🔑 Reusing existing GitHub SSH key at ${chalk.cyan(`./${githubKeyPath}`)} and rebuilding container with it (no need to add new key at GitHub).`,
      );
    }

    // Step 1: Stop container if running
    if (isRunning) {
      const spinner = new Spinner('Stopping container...');
      spinner.start();
      await docker.stopContainer(containerName, options.force);
      spinner.succeed('Container stopped');
    }

    // Step 2: Handle container SSH key removal before rebuild
    await ssh.updateContainerKeyForRebuild('localhost', CONSTANTS.SSH.PORT);

    // Step 4: Remove old container if it exists
    const containerExists = await docker.containerExists(containerName);
    if (containerExists) {
      const removeSpinner = new Spinner('Removing old container...');
      removeSpinner.start();
      await docker.removeContainer(containerName, true);
      removeSpinner.succeed('Old container removed');
    } else {
      logger.info('No existing container to remove');
    }

    // Step 5: Build new image
    logger.info('\n📦 Building new container image...\n');

    const buildResult = await docker.composeBuild(options.noCache || false);
    if (!buildResult) {
      logger.error('Failed to build container image');
      process.exit(1);
    }

    logger.success('✨ Container image rebuilt successfully');

    // Step 6: Start new container
    const startSpinner = new Spinner('Starting new container...');
    startSpinner.start();

    const upResult = await docker.composeUp(true, false);
    if (!upResult) {
      startSpinner.fail('Failed to start container');
      process.exit(1);
    }

    startSpinner.succeed('Container started');

    // Step 7: Initialize container and setup SSH
    const initResult = await docker.initializeContainerWithSSH(containerName, {
      timeout: 60000, // 60 seconds timeout for rebuild
      isRebuild: true,
    });

    if (!initResult.success) {
      process.exit(1);
    }

    // Step 8: Verify container is healthy
    const healthSpinner = new Spinner('Verifying container health...');
    healthSpinner.start();

    const isHealthy = await docker.isContainerRunning(containerName);
    if (isHealthy) {
      healthSpinner.succeed('Container is healthy and running');
    } else {
      healthSpinner.fail('Container health check failed');
      process.exit(1);
    }

    logger.success('\n✨ Container rebuilt successfully!');
    logger.info('\nYou can now connect to the container:');
    logger.step(`${chalk.cyan('devvy connect')} - Connect via SSH`);
    logger.step(`${chalk.cyan('devvy connect -m')} - Connect via Mosh`);
  } catch (error) {
    logger.error('Failed to rebuild container', error);
    process.exit(1);
  }
}
