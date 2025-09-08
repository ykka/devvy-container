import { ComposeService } from '@services/compose.service';
import { ConfigService } from '@services/config.service';
import { DockerService } from '@services/docker.service';
import { SSHService } from '@services/ssh.service';
import { logger } from '@utils/logger';
import { Spinner } from '@utils/spinner';
import chalk from 'chalk';

export interface StartOptions {
  build?: boolean;
  detach?: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const dockerService = DockerService.getInstance();
  const composeService = ComposeService.getInstance();
  const config = ConfigService.getInstance();
  const sshService = SSHService.getInstance();

  try {
    // Validate environment before starting
    const validation = await config.validateEnvironment();
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

    const isDockerRunning = await dockerService.isDockerRunning();
    if (!isDockerRunning) {
      spinner.fail('Docker daemon is not running. Please start Docker first.');
      process.exit(1);
    }
    spinner.next();

    // Validation step
    spinner.next();

    const containerName = config.getDockerConfig().containerName;
    const containerInfo = await dockerService.getContainerInfo(containerName);

    if (containerInfo && containerInfo.state === 'running') {
      spinner.complete();
      logger.info('Container is already running');

      const sshConfig = config.getSshConfig();
      logger.info(`SSH: ssh -p ${sshConfig.port} ${sshConfig.user}@localhost`);
      return;
    }
    spinner.next();

    const sshCfg = config.getSshConfig();
    await sshService.removeContainerSSHKeyFromHostKnownHosts('localhost', sshCfg.port);
    spinner.next();

    const success = await composeService.up({
      detach: options.detach !== false,
      build: options.build,
    });

    if (!success) {
      spinner.fail('Failed to start container');
      process.exit(1);
    }
    spinner.next();

    await sshService.addContainerSSHKeyToHostKnownHosts('localhost', sshCfg.port);
    spinner.next();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newContainerInfo = await dockerService.getContainerInfo(containerName);
    if (!newContainerInfo || newContainerInfo.state !== 'running') {
      spinner.fail('Container failed to start properly');
      process.exit(1);
    }

    spinner.complete();

    logger.success('Container started successfully');

    const sshConfig = config.getSshConfig();
    logger.info(`\nConnect with: ${chalk.cyan(`devvy connect`)}`);
    logger.info(`Or use SSH: ${chalk.cyan(`ssh -p ${sshConfig.port} ${sshConfig.user}@localhost`)}`);
  } catch (error) {
    logger.error('Failed to start container', error);
    process.exit(1);
  }
}
