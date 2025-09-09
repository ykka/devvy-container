import { CONSTANTS } from '@config/constants';
import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import chalk from 'chalk';
import Table from 'cli-table3';
import Docker from 'dockerode';

export interface StatusOptions {
  json?: boolean;
  verbose?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  try {
    const containerName = CONSTANTS.DOCKER.CONTAINER_NAME;

    const isDockerRunning = await docker.isDockerRunning();
    if (!isDockerRunning) {
      if (options.json) {
        process.stdout.write(`${JSON.stringify({ status: 'docker-not-running' }, null, 2)}\n`);
      } else {
        logger.error('Docker daemon is not running');
      }
      process.exit(1);
    }

    const containerInfo = await docker.getContainerInfo(containerName).catch(() => null);

    if (options.json) {
      process.stdout.write(`${JSON.stringify(containerInfo, null, 2)}\n`);
      return;
    }

    logger.info(chalk.bold.cyan('Container Status'));
    logger.info('');

    if (!containerInfo) {
      logger.warn(`Container '${containerName}' does not exist`);
      logger.info(`Run ${chalk.cyan('devvy start')} to create and start the container`);
      return;
    }

    const statusIcon = containerInfo.state === 'running' ? '●' : '○';
    const statusColor = containerInfo.state === 'running' ? chalk.green : chalk.red;
    const statusText = containerInfo.state.charAt(0).toUpperCase() + containerInfo.state.slice(1);

    const table = new Table({
      style: { head: ['cyan'] },
      colWidths: [20, 60],
    });

    table.push(['Status', statusColor(`${statusIcon} ${statusText}`)], ['Container Name', containerInfo.name], ['Container ID', containerInfo.id.slice(0, 12)]);

    if (containerInfo.state === 'running') {
      const ipAddress = await getContainerIP(containerName);
      if (ipAddress) {
        table.push(['IP Address', ipAddress]);
      }

      table.push(['Uptime', getUptime(containerInfo.created)]);

      const ports = await getContainerPorts(containerName);
      if (ports.length > 0) {
        table.push(['Port Mappings', ports.join('\n')]);
      }

      if (options.verbose) {
        const stats = await getContainerStats(containerName);
        if (stats) {
          table.push(['CPU Usage', stats.cpu], ['Memory Usage', stats.memory], ['Network I/O', stats.network]);
        }

        const volumes = await getContainerVolumes(containerName);
        if (volumes.length > 0) {
          table.push(['Volumes', volumes.join('\n')]);
        }
      }
    } else {
      table.push(['Exit Code', containerInfo.exitCode?.toString() || 'N/A']);
      if (containerInfo.finishedAt) {
        table.push(['Stopped At', new Date(containerInfo.finishedAt).toLocaleString()]);
      }
    }

    process.stdout.write(`${table.toString()}\n`);

    if (containerInfo.state === 'running') {
      logger.info('');
      logger.info(`Connect with: ${chalk.cyan('devvy connect')}`);
      logger.info(`Or use SSH: ${chalk.cyan(`ssh -p ${CONSTANTS.SSH.PORT} ${CONSTANTS.CONTAINER_USER_NAME}@localhost`)}`);
    } else {
      logger.info('');
      logger.info(`Start the container with: ${chalk.cyan('devvy start')}`);
    }

    if (options.verbose && containerInfo.state === 'running') {
      logger.info('');
      logger.info(`Health Check: ${await checkContainerHealth(containerName)}`);
    }
  } catch (error) {
    logger.error('Failed to get container status', error);
    process.exit(1);
  }
}

async function getContainerIP(containerName: string): Promise<string | null> {
  try {
    const dockerInstance = new Docker();
    const container = dockerInstance.getContainer(containerName);
    const data = await container.inspect();

    const networks = data.NetworkSettings?.Networks;
    if (networks) {
      const firstNetwork = Object.values(networks)[0];
      return (firstNetwork as any)?.IPAddress || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function getContainerPorts(containerName: string): Promise<string[]> {
  try {
    const dockerInstance = new Docker();
    const container = dockerInstance.getContainer(containerName);
    const data = await container.inspect();

    const ports: string[] = [];
    const portBindings = data.NetworkSettings?.Ports;

    if (portBindings) {
      for (const [containerPort, hostBindings] of Object.entries(portBindings)) {
        if (hostBindings && Array.isArray(hostBindings)) {
          for (const binding of hostBindings) {
            if (binding && typeof binding === 'object' && 'HostPort' in binding) {
              ports.push(`${(binding as any).HostPort} → ${containerPort}`);
            }
          }
        }
      }
    }

    return ports;
  } catch {
    return [];
  }
}

async function getContainerStats(containerName: string): Promise<{
  cpu: string;
  memory: string;
  network: string;
} | null> {
  try {
    const dockerInstance = new Docker();
    const container = dockerInstance.getContainer(containerName);

    const stream = await container.stats({ stream: false });
    const stats = stream as any;

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

    const memUsage = stats.memory_stats.usage;
    const memLimit = stats.memory_stats.limit;
    const memPercent = (memUsage / memLimit) * 100;

    let rxBytes = 0;
    let txBytes = 0;
    if (stats.networks) {
      for (const network of Object.values(stats.networks)) {
        rxBytes += (network as any).rx_bytes || 0;
        txBytes += (network as any).tx_bytes || 0;
      }
    }

    return {
      cpu: `${cpuPercent.toFixed(2)}%`,
      memory: `${formatBytes(memUsage)} / ${formatBytes(memLimit)} (${memPercent.toFixed(1)}%)`,
      network: `↓ ${formatBytes(rxBytes)} / ↑ ${formatBytes(txBytes)}`,
    };
  } catch {
    return null;
  }
}

async function getContainerVolumes(containerName: string): Promise<string[]> {
  try {
    const dockerInstance = new Docker();
    const container = dockerInstance.getContainer(containerName);
    const data = await container.inspect();

    const volumes: string[] = [];
    const mounts = data.Mounts;

    if (mounts && Array.isArray(mounts)) {
      for (const mount of mounts) {
        if (mount.Type === 'volume') {
          volumes.push(`${mount.Name?.split('_').pop() || mount.Name} → ${mount.Destination}`);
        } else if (mount.Type === 'bind') {
          volumes.push(`${mount.Source} → ${mount.Destination}`);
        }
      }
    }

    return volumes;
  } catch {
    return [];
  }
}

async function checkContainerHealth(containerName: string): Promise<string> {
  try {
    const dockerInstance = new Docker();
    const container = dockerInstance.getContainer(containerName);
    const data = await container.inspect();

    const health = data.State?.Health;
    if (health) {
      const status = health.Status;
      const failingStreak = health.FailingStreak || 0;

      if (status === 'healthy') {
        return chalk.green('✓ Healthy');
      } else if (status === 'unhealthy') {
        return chalk.red(`✗ Unhealthy (${failingStreak} failures)`);
      } else {
        return chalk.yellow('⚠ Starting...');
      }
    }

    return chalk.gray('No health check configured');
  } catch {
    return chalk.gray('Unable to check health');
  }
}

function getUptime(created: string): string {
  const startTime = new Date(created).getTime();
  const now = Date.now();
  const uptimeMs = now - startTime;

  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : 'Just started';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
