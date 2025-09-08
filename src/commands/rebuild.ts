import { CONSTANTS } from '@config/constants';
import * as compose from '@services/compose';
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

    // Step 1: Stop container if running
    if (isRunning) {
      const spinner = new Spinner('Stopping container...');
      spinner.start();
      await docker.stopContainer(containerName, options.force);
      spinner.succeed('Container stopped');
    }

    // Step 2: Handle container SSH key removal before rebuild
    await ssh.updateContainerKeyForRebuild('localhost', CONSTANTS.SSH.PORT);

    // Step 4: Remove old container
    const removeSpinner = new Spinner('Removing old container...');
    removeSpinner.start();
    await docker.removeContainer(containerName, true);
    removeSpinner.succeed('Old container removed');

    // Step 5: Build new image
    logger.info('\n📦 Building new container image...\n');

    try {
      await compose.composeBuild(options.noCache || false);
    } catch {
      logger.error('Failed to build container image');
      process.exit(1);
    }

    logger.success('✨ Container image rebuilt successfully');

    // Step 6: Start new container
    const startSpinner = new Spinner('Starting new container...');
    startSpinner.start();

    try {
      await compose.composeUp(true, false);
    } catch {
      startSpinner.fail('Failed to start container');
      process.exit(1);
    }

    startSpinner.succeed('Container started');

    // Step 7: Wait for container to be ready
    const containerReadySpinner = new Spinner('Waiting for container to be ready...');
    containerReadySpinner.start();

    let containerReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!containerReady && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const result = await docker.execInContainer(containerName, ['true']);
        if (result.exitCode === 0) {
          containerReady = true;
        }
      } catch {
        // Container not ready yet
      }
      attempts++;
    }

    if (!containerReady) {
      containerReadySpinner.fail('Container did not become ready in time');
      process.exit(1);
    }

    containerReadySpinner.succeed('Container is ready');

    // Step 8: Add container's new SSH key to host's known_hosts
    console.log(`\n${chalk.blue("Adding container's new SSH key to host's known_hosts...")}`);
    const sshAdded = await ssh.addContainerSSHKeyToHostKnownHosts('localhost', CONSTANTS.SSH.PORT);

    if (!sshAdded) {
      logger.warn("Container's SSH key was not added to host's known_hosts.");
      logger.info("You will be prompted to verify the container's SSH key on first connection.");
    }

    // Step 9: Verify container is healthy
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
