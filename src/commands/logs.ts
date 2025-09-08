import type { Readable } from 'node:stream';

import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import chalk from 'chalk';
import Docker from 'dockerode';

export interface LogsOptions {
  follow?: boolean;
  tail?: string | number;
  timestamps?: boolean;
  since?: string;
  until?: string;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;

    const isDockerRunning = await docker.isDockerRunning();
    if (!isDockerRunning) {
      logger.error('Docker daemon is not running');
      process.exit(1);
    }

    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);
    if (!containerInfo) {
      logger.error(`Container '${containerName}' does not exist`);
      logger.info(`Run ${chalk.cyan('devvy start')} to create the container`);
      process.exit(1);
    }

    logger.info(chalk.cyan(`Fetching logs from container '${containerName}'...`));
    if (options.follow) {
      logger.info(chalk.gray('(Press Ctrl+C to stop following logs)'));
    }
    logger.info('');

    const dockerInstance = new Docker();
    const container = dockerInstance.getContainer(containerName);

    interface DockerLogsOptions {
      stdout: boolean;
      stderr: boolean;
      follow: boolean;
      timestamps: boolean;
      tail?: number | 'all';
      since?: number;
      until?: number;
    }

    const logsOptions: DockerLogsOptions = {
      stdout: true,
      stderr: true,
      follow: options.follow || false,
      timestamps: options.timestamps || false,
    };

    if (options.tail === undefined) {
      logsOptions.tail = options.follow ? 100 : 'all';
    } else {
      const tailValue = typeof options.tail === 'string' ? Number.parseInt(options.tail, 10) : options.tail;
      logsOptions.tail = Number.isNaN(tailValue) ? 'all' : tailValue;
    }

    if (options.since) {
      logsOptions.since = parseTimeValue(options.since);
    }

    if (options.until) {
      logsOptions.until = parseTimeValue(options.until);
    }

    const logStream = (await container.logs(logsOptions as any)) as unknown;

    if (options.follow) {
      (container as any).modem.demuxStream(logStream as unknown as Readable, process.stdout, process.stderr);

      process.on('SIGINT', () => {
        logger.info('');
        logger.info('Stopped following logs');
        process.exit(0);
      });

      await new Promise<void>(() => {});
    } else {
      const logs = await streamToString(logStream as unknown as Readable);
      const formattedLogs = formatLogs(logs, options.timestamps || false);
      process.stdout.write(`${formattedLogs}\n`);
    }
  } catch (error) {
    logger.error('Failed to fetch logs', error);
    process.exit(1);
  }
}

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const logs = demuxDockerLogs(buffer);
      resolve(logs);
    });

    stream.on('error', reject);
  });
}

function demuxDockerLogs(buffer: Buffer): string {
  let output = '';
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;

    const header = buffer.slice(offset, offset + 8);
    const streamType = header[0];
    const length = header.readUInt32BE(4);

    if (offset + 8 + length > buffer.length) break;

    const payload = buffer.slice(offset + 8, offset + 8 + length);

    if (streamType === 1 || streamType === 2) {
      output += payload.toString('utf8');
    }

    offset += 8 + length;
  }

  return output;
}

function formatLogs(logs: string, includeTimestamps: boolean): string {
  const lines = logs.split('\n').filter((line) => line.trim());

  return lines
    .map((line) => {
      if (includeTimestamps) {
        return line;
      }

      const timestampMatch = line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+(.*)/);
      if (timestampMatch?.[1]) {
        return timestampMatch[1];
      }

      if (line.includes('[ERROR]') || line.toLowerCase().includes('error')) {
        return chalk.red(line);
      } else if (line.includes('[WARN]') || line.toLowerCase().includes('warning')) {
        return chalk.yellow(line);
      } else if (line.includes('[INFO]')) {
        return chalk.cyan(line);
      } else if (line.includes('[DEBUG]')) {
        return chalk.gray(line);
      }

      return line;
    })
    .join('\n');
}

function parseTimeValue(value: string): number {
  const now = Date.now() / 1000;

  const relativeMatch = value.match(/^(\d+)([dhms])$/);
  if (relativeMatch?.[1] && relativeMatch[2]) {
    const amount = Number.parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];

    let seconds = 0;
    switch (unit) {
      case 's': {
        seconds = amount;
        break;
      }
      case 'm': {
        seconds = amount * 60;
        break;
      }
      case 'h': {
        seconds = amount * 60 * 60;
        break;
      }
      case 'd': {
        seconds = amount * 60 * 60 * 24;
        break;
      }
    }

    return now - seconds;
  }

  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return timestamp / 1000;
  }

  return 0;
}
