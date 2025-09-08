import * as path from 'node:path';

import { CONSTANTS } from '@config/constants';
import { ConfigService } from '@services/config.service';
import { DockerService } from '@services/docker.service';
import { logger } from '@utils/logger';
import { commandExists, execInteractive } from '@utils/shell';
import * as fs from 'fs-extra';

export interface ConnectOptions {
  mosh?: boolean;
  tmux?: boolean;
}

export async function connectCommand(options: ConnectOptions): Promise<void> {
  const dockerService = DockerService.getInstance();
  const config = ConfigService.getInstance();

  try {
    const containerName = config.getDockerConfig().containerName;
    const containerInfo = await dockerService.getContainerInfo(containerName);

    if (!containerInfo || containerInfo.state !== 'running') {
      logger.error('Container is not running. Please start it first with: devvy start');
      process.exit(1);
    }

    const sshConfig = config.getSshConfig();
    const sshKeyPath = path.join(process.cwd(), CONSTANTS.HOST_PATHS.SECRETS_DIR, CONSTANTS.SSH.KEY_NAME);

    if (!(await fs.pathExists(sshKeyPath))) {
      logger.error(`SSH key not found at: ${sshKeyPath}`);
      logger.info('Please run "devvy setup" to generate SSH keys');
      process.exit(1);
    }

    const connectionMethod = options.mosh ? 'mosh' : 'ssh';

    if (options.mosh && !(await commandExists('mosh'))) {
      logger.error('Mosh is not installed. Please install it first or use SSH instead.');
      logger.info('Install with: brew install mosh (macOS) or apt-get install mosh (Linux)');
      process.exit(1);
    }

    logger.info(`Connecting to container via ${connectionMethod.toUpperCase()}...`);

    let command: string;
    let args: string[];

    if (options.mosh) {
      command = 'mosh';
      args = ['--ssh', `ssh -p ${sshConfig.port} -i ${sshKeyPath}`, `${sshConfig.user}@localhost`];

      if (options.tmux) {
        args.push('--', 'tmux', 'new-session', '-A', '-s', 'main');
      }
    } else {
      command = 'ssh';
      args = ['-p', String(sshConfig.port), '-i', sshKeyPath, `${sshConfig.user}@localhost`];

      if (options.tmux) {
        args.push('-t', 'tmux new-session -A -s main');
      }
    }

    logger.command(`${command} ${args.join(' ')}`);

    const exitCode = await execInteractive(command, args);

    if (exitCode !== 0) {
      logger.error(`Connection failed with exit code: ${exitCode}`);

      logger.info('\nTroubleshooting tips:');
      logger.info('1. Ensure the container is running: devvy status');
      logger.info('2. Check SSH service in container: devvy logs | grep ssh');
      logger.info(`3. Verify SSH key permissions: chmod 600 ${sshKeyPath}`);
      logger.info('4. Try rebuilding the container: devvy rebuild');

      process.exit(exitCode);
    }
  } catch (error) {
    logger.error('Failed to connect to container', error);
    process.exit(1);
  }
}
