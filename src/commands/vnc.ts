import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import chalk from 'chalk';

export async function vnc(): Promise<void> {
  const isRunning = await docker.isContainerRunning('devvy-container');

  if (!isRunning) {
    logger.warn('Container is not running. Start it first with:');
    console.log(chalk.cyan('  devvy start\n'));
    return;
  }

  console.log(chalk.bold('📺 VNC Browser Monitoring\n'));

  console.log(chalk.green('VNC is automatically running when container starts!\n'));

  console.log(chalk.yellow('Connect from your Mac:'));
  console.log('  1. Open Finder');
  console.log('  2. Press Cmd+K (Connect to Server)');
  console.log(`  3. Enter: ${chalk.cyan('vnc://localhost:5900')}`);
  console.log(`  4. Password: ${chalk.cyan('devvy')}\n`);

  console.log(chalk.yellow('Alternative - Use any VNC client:'));
  console.log(`  • Host: ${chalk.cyan('localhost')}`);
  console.log(`  • Port: ${chalk.cyan('5900')}`);
  console.log(`  • Password: ${chalk.cyan('devvy')}\n`);

  console.log(chalk.dim('Chromium will display here when launched by Playwright'));
  console.log(chalk.dim('VNC runs automatically - no need to start/stop it'));
}
