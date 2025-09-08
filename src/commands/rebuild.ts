import { ComposeService } from '@services/compose.service';
import { ConfigService } from '@services/config.service';
import { DockerService } from '@services/docker.service';
import { SSHService } from '@services/ssh.service';
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
    const config = ConfigService.getInstance();
    const docker = DockerService.getInstance();
    const compose = ComposeService.getInstance();
    const sshService = SSHService.getInstance();
    const containerName = config.getDockerConfig().containerName;
    const sshConfig = config.getSshConfig();

    // Check if container is running
    const containerInfo = await docker.getContainer(containerName);
    const isRunning = containerInfo ? await docker.isRunning(containerName) : false;

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

    // Step 2: Clean up SSH known hosts before rebuild
    const sshSpinner = new Spinner('Managing SSH configuration...');
    sshSpinner.start();
    await sshService.manageKnownHosts('remove', 'localhost', sshConfig.port);
    sshSpinner.succeed('SSH known hosts cleaned up');

    // Step 3: Remove old container
    if (containerInfo) {
      const spinner = new Spinner('Removing old container...');
      spinner.start();
      await docker.removeContainer(containerName, true);
      spinner.succeed('Old container removed');
    }

    // Step 4: Build new image
    const buildSpinner = new Spinner('Building new container image...');
    buildSpinner.start();

    const buildArgs = ['build'];
    if (options.noCache) {
      buildArgs.push('--no-cache');
    }

    const buildResult = await compose.run(buildArgs);
    if (!buildResult.success) {
      buildSpinner.fail('Failed to build container image');
      logger.error(buildResult.stderr);
      process.exit(1);
    }

    buildSpinner.succeed('Container image rebuilt successfully');

    // Step 5: Start new container
    const startSpinner = new Spinner('Starting new container...');
    startSpinner.start();

    const startResult = await compose.up({ detach: true });
    if (!startResult) {
      startSpinner.fail('Failed to start container');
      process.exit(1);
    }

    startSpinner.succeed('Container started');

    // Step 6: Wait for SSH to be ready
    const sshReadySpinner = new Spinner('Waiting for SSH service...');
    sshReadySpinner.start();

    let sshReady = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!sshReady && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const result = await docker.exec(containerName, ['true']);
        if (result.success) {
          sshReady = true;
        }
      } catch {
        // Container not ready yet
      }
      attempts++;
    }

    if (!sshReady) {
      sshReadySpinner.fail('SSH service did not start in time');
      process.exit(1);
    }

    sshReadySpinner.succeed('SSH service ready');

    // Step 7: Add new SSH host key to known hosts
    const keySpinner = new Spinner('Adding new SSH host key...');
    keySpinner.start();

    await sshService.manageKnownHosts('add', 'localhost', sshConfig.port);
    keySpinner.succeed('New SSH host key added to known hosts');

    // Step 9: Verify container is healthy
    const healthSpinner = new Spinner('Verifying container health...');
    healthSpinner.start();

    const isHealthy = await docker.isRunning(containerName);
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
