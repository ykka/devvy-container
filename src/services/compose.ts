import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import { execa } from 'execa';

/**
 * Run docker-compose up
 */
export async function composeUp(detach = true, build = false): Promise<void> {
  const command = ['docker', 'compose', '-p', CONSTANTS.DOCKER.PROJECT_NAME, '-f', CONSTANTS.DOCKER.COMPOSE_FILE, 'up'];

  if (detach) {
    command.push('-d');
  }

  if (build) {
    command.push('--build');
  }

  logger.command(command.join(' '));

  const [cmd, ...args] = command;
  if (!cmd) throw new Error('Invalid command');
  const result = await execa(cmd, args, {
    stdio: detach ? 'pipe' : 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error('Failed to run docker-compose up');
  }

  logger.success('Docker Compose up completed successfully');
}

/**
 * Run docker-compose down
 */
export async function composeDown(removeVolumes = false): Promise<void> {
  const command = ['docker', 'compose', '-p', CONSTANTS.DOCKER.PROJECT_NAME, '-f', CONSTANTS.DOCKER.COMPOSE_FILE, 'down'];

  if (removeVolumes) {
    command.push('-v');
  }

  logger.command(command.join(' '));

  const [cmd, ...args] = command;
  if (!cmd) throw new Error('Invalid command');
  const result = await execa(cmd, args, {
    stdio: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error('Failed to run docker-compose down');
  }

  logger.success('Docker Compose down completed successfully');
}

/**
 * Build docker-compose services
 */
export async function composeBuild(noCache = false): Promise<void> {
  const command = ['docker', 'compose', '-p', CONSTANTS.DOCKER.PROJECT_NAME, '-f', CONSTANTS.DOCKER.COMPOSE_FILE, 'build'];

  if (noCache) {
    command.push('--no-cache');
  }

  logger.command(command.join(' '));

  const [cmd, ...args] = command;
  if (!cmd) throw new Error('Invalid command');
  const result = await execa(cmd, args, {
    stdio: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error('Failed to build Docker image');
  }

  logger.success('Docker image built successfully');
}
