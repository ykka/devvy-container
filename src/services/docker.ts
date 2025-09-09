import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import Docker from 'dockerode';
import { execa } from 'execa';

export interface ContainerInfo {
  id: string;
  name: string;
  state: string;
  status: string;
  image: string;
  ports: Array<{
    private: number;
    public: number;
    type: string;
  }>;
  created: string;
  exitCode?: number;
  finishedAt?: string;
}

// Single docker instance at module level
const docker = new Docker();

/**
 * Check if Docker daemon is running
 */
export async function isDockerRunning(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get container by name or ID
 */
export async function getContainer(name: string): Promise<Docker.Container> {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find((c) => c.Names.includes(`/${name}`) || c.Id === name);

  if (!container) {
    throw new Error(`Container ${name} not found`);
  }

  return docker.getContainer(container.Id);
}

/**
 * Get detailed container information
 */
export async function getContainerInfo(name: string): Promise<ContainerInfo> {
  const container = await getContainer(name);
  const info = await container.inspect();

  return {
    id: info.Id,
    name: info.Name.replace(/^\//, ''),
    state: info.State.Status,
    status: info.State.Running ? 'Running' : 'Stopped',
    image: info.Config.Image,
    ports: Object.entries(info.NetworkSettings.Ports || {}).map(([key, value]) => {
      const [privatePort, type] = key.split('/');
      const publicPort = value?.[0]?.HostPort;
      return {
        private: Number.parseInt(privatePort ?? '0', 10),
        public: publicPort ? Number.parseInt(publicPort, 10) : 0,
        type: type || 'tcp',
      };
    }),
    created: info.Created,
    exitCode: info.State.ExitCode,
    finishedAt: info.State.FinishedAt,
  };
}

/**
 * Stop a container
 */
export async function stopContainer(name: string, force = false): Promise<void> {
  const container = await getContainer(name);
  const info = await container.inspect();

  if (!info.State.Running) {
    logger.info('Container is already stopped');
    return;
  }

  await (force ? container.kill() : container.stop());
  logger.success(`Container ${name} stopped successfully`);
}

/**
 * Check if container is running
 */
export async function isContainerRunning(name: string): Promise<boolean> {
  try {
    const container = await getContainer(name);
    const info = await container.inspect();
    return info.State.Running;
  } catch {
    return false;
  }
}

/**
 * Remove a container
 */
export async function removeContainer(name: string, force = false): Promise<void> {
  try {
    const container = await getContainer(name);
    await container.remove({ force });
    logger.success(`Container ${name} removed successfully`);
  } catch (error: any) {
    // Container not found is not an error for removal
    if (error.message?.includes('not found')) {
      logger.info(`Container ${name} not found`);
      return;
    }
    throw error;
  }
}

/**
 * Execute command in container
 */
export async function execInContainer(name: string, command: string[]): Promise<{ exitCode: number; output: string }> {
  const container = await getContainer(name);

  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: false,
    Tty: false,
  });

  const stream = await exec.start({});

  return new Promise((resolve, reject) => {
    let output = '';

    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    stream.on('end', async () => {
      const inspectInfo = await exec.inspect();
      resolve({
        exitCode: inspectInfo.ExitCode || 0,
        output,
      });
    });

    stream.on('error', reject);
  });
}

// Docker Compose operations

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
