import type { Readable } from 'node:stream';

import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import chalk from 'chalk';
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
 * Check if a container exists
 */
export async function containerExists(name: string): Promise<boolean> {
  try {
    await getContainer(name);
    return true;
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
export async function composeUp(detach = true, build = false): Promise<boolean> {
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
    logger.error('Failed to run docker-compose up');
    return false;
  }

  logger.success('Docker Compose up completed successfully');
  return true;
}

/**
 * Run docker-compose down
 */
export async function composeDown(removeVolumes = false): Promise<void> {
  const command = [
    'docker',
    'compose',
    '-p',
    CONSTANTS.DOCKER.PROJECT_NAME,
    '-f',
    CONSTANTS.DOCKER.COMPOSE_FILE,
    'down',
  ];

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
export async function composeBuild(noCache = false): Promise<boolean> {
  const command = [
    'docker',
    'compose',
    '-p',
    CONSTANTS.DOCKER.PROJECT_NAME,
    '-f',
    CONSTANTS.DOCKER.COMPOSE_FILE,
    'build',
  ];

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
    logger.error('Failed to build Docker image');
    return false;
  }

  logger.success('Docker image built successfully');
  return true;
}

/**
 * Stream container logs in real-time
 */
export async function streamContainerLogs(
  name: string,
  onData: (chunk: string) => void,
  since?: number,
): Promise<() => void> {
  const container = await getContainer(name);

  const logStream = (await container.logs({
    stdout: true,
    stderr: true,
    follow: true,
    timestamps: false,
    since: since || 0,
  })) as unknown as Readable;

  // Handle Docker's multiplexed stream format
  let buffer = Buffer.alloc(0);

  const handleData = (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Process complete frames from the buffer
    while (buffer.length >= 8) {
      // Docker multiplexed stream format:
      // [STREAM_TYPE:1][PADDING:3][SIZE:4][PAYLOAD:SIZE]
      const header = buffer.slice(0, 8);
      const payloadSize = header.readUInt32BE(4);

      if (buffer.length < 8 + payloadSize) {
        // Not enough data for complete frame
        break;
      }

      const payload = buffer.slice(8, 8 + payloadSize);
      const text = payload.toString('utf8');

      // Send the text line by line
      const lines = text.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        onData(line);
      }

      // Remove processed frame from buffer
      buffer = buffer.slice(8 + payloadSize);
    }
  };

  logStream.on('data', handleData);

  // Return cleanup function
  return () => {
    logStream.destroy();
  };
}

/**
 * Wait for container to be ready by monitoring logs
 */
export async function waitForContainerReady(
  name: string,
  options: {
    readyMarker?: string;
    errorPatterns?: string[];
    timeout?: number;
    onProgress?: (line: string) => void;
  } = {},
): Promise<{ ready: boolean; logs: string[]; error?: string }> {
  const {
    readyMarker = '--CLAUDE-DEVVY-CONTAINER-READY--',
    errorPatterns = ['[INIT:ERROR]', 'ERROR:', 'Failed to', 'Permission denied', 'timeout'],
    timeout = 60000,
    onProgress,
  } = options;

  const logs: string[] = [];
  let error: string | undefined;
  let cleanup: (() => void) | undefined;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      if (cleanup) cleanup();
      resolve({
        ready: false,
        logs: logs.slice(-50), // Last 50 lines for debugging
        error: `Container initialization timed out after ${timeout / 1000} seconds`,
      });
    }, timeout);

    // Start streaming logs
    streamContainerLogs(name, (line) => {
      logs.push(line);

      // Send progress update
      if (onProgress) {
        onProgress(line);
      }

      // Check for ready marker
      if (line.includes(readyMarker)) {
        clearTimeout(timeoutId);
        if (cleanup) cleanup();
        resolve({ ready: true, logs });
        return;
      }

      // Check for error patterns
      for (const pattern of errorPatterns) {
        if (line.includes(pattern)) {
          error = `Initialization failed: ${line}`;
          clearTimeout(timeoutId);
          if (cleanup) cleanup();
          resolve({
            ready: false,
            logs: logs.slice(-50),
            error,
          });
          return;
        }
      }
    })
      .then((cleanupFn) => {
        cleanup = cleanupFn;
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        resolve({
          ready: false,
          logs,
          error: `Failed to stream logs: ${err.message}`,
        });
      });
  });
}

/**
 * Initialize container and setup SSH access
 * Shared method used by both start and rebuild commands
 */
export async function initializeContainerWithSSH(
  containerName: string,
  options: {
    timeout?: number;
    onProgress?: (line: string) => void;
    isRebuild?: boolean;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  const { timeout = 30000, onProgress, isRebuild = false } = options;

  // Wait for container to be fully ready
  logger.info('\n📋 Waiting for container initialization...');
  if (isRebuild) {
    logger.info(chalk.gray('Waiting for container to complete initialization...\n'));
  }

  const readyResult = await waitForContainerReady(containerName, {
    timeout,
    onProgress: (line) => {
      // Show initialization progress to user
      if (line.startsWith('[INIT]')) {
        if (isRebuild) {
          logger.info(chalk.gray(`  ${line}`));
        } else {
          logger.debug(line);
        }
      }
      if (onProgress) {
        onProgress(line);
      }
    },
  });

  if (!readyResult.ready) {
    if (isRebuild) {
      logger.error('\n❌ Container initialization failed!');

      if (readyResult.error) {
        logger.error(`Error: ${readyResult.error}`);
      }

      if (readyResult.logs.length > 0) {
        logger.error('\nLast log entries before failure:');
        for (const logLine of readyResult.logs.slice(-10)) {
          logger.error(chalk.gray(`  ${logLine}`));
        }
      }

      logger.info('\nTroubleshooting tips:');
      logger.step('Check if all required files are present in ./secrets/');
      logger.step('Ensure Docker has enough resources allocated');
      logger.step('Try rebuilding with --no-cache flag');
      logger.step(`Run ${chalk.cyan('devvy logs -f')} in another terminal for detailed output`);
    }

    return {
      success: false,
      error: readyResult.error || 'Container initialization failed',
    };
  }

  if (isRebuild) {
    logger.success('\n✅ Container initialization completed successfully!');
  }

  // Add container's SSH key to host's known_hosts
  const ssh = await import('./ssh.js');

  if (isRebuild) {
    console.log(`\n${chalk.blue("Adding container's new SSH key to host's known_hosts...")}`);
  }

  const sshAdded = await ssh.addContainerSSHKeyToHostKnownHosts('localhost', CONSTANTS.SSH.PORT);

  if (!sshAdded) {
    logger.warn("Container's SSH key was not added to host's known_hosts.");
    logger.info("You will be prompted to verify the container's SSH key on first connection.");
  }

  return { success: true };
}
