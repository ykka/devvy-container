import * as docker from '@services/docker';
import { logger } from '@utils/logger';
import chalk from 'chalk';

export async function vnc(): Promise<void> {
  logger.info('VNC Browser Monitoring Instructions\n');

  // Check if container is running
  const isRunning = await docker.isContainerRunning('claude-devvy-container');

  if (!isRunning) {
    logger.warn('Container is not running. Start it first with:');
    console.log(chalk.cyan('  devvy start'));
    console.log('');
    logger.info('Then run this command again to see VNC instructions.');
    return;
  }

  // Display connection instructions
  console.log(chalk.bold('📺 VNC Setup for Browser Monitoring\n'));

  console.log(chalk.yellow('Step 1: Start VNC Server (inside container)'));
  console.log('  First, connect to the container:');
  console.log(chalk.cyan('  devvy connect'));
  console.log('');
  console.log('  Then start the VNC server:');
  console.log(chalk.cyan('  start-vnc'));
  console.log('');

  console.log(chalk.yellow('Step 2: Connect from your Mac'));
  console.log('');
  console.log(chalk.green('Option A: macOS Screen Sharing (Recommended)'));
  console.log('  1. Open Finder');
  console.log('  2. Press ' + chalk.bold('Cmd+K') + ' (Connect to Server)');
  console.log('  3. Enter: ' + chalk.cyan('vnc://localhost:5900'));
  console.log('  4. Password: ' + chalk.cyan('devvy'));
  console.log('');

  console.log(chalk.green('Option B: VNC Client'));
  console.log('  Use any VNC client (RealVNC, TigerVNC, etc.)');
  console.log('  • Host: ' + chalk.cyan('localhost'));
  console.log('  • Port: ' + chalk.cyan('5900'));
  console.log('  • Password: ' + chalk.cyan('devvy'));
  console.log('');

  console.log(chalk.yellow('Step 3: Launch Chrome (inside container)'));
  console.log('  Once connected via VNC, you can manually test Chrome:');
  console.log(chalk.cyan('  DISPLAY=:99 google-chrome --no-sandbox'));
  console.log('');

  console.log(chalk.dim('─'.repeat(50)));
  console.log('');
  console.log(chalk.bold('🤖 For Playwright MCP'));
  console.log('  Playwright MCP will automatically use the virtual display.');
  console.log('  Chrome will appear in your VNC viewer when Claude Code');
  console.log('  launches it through the Playwright MCP.');
  console.log('');

  console.log(chalk.bold('🛑 To Stop VNC'));
  console.log('  Inside the container, run:');
  console.log(chalk.cyan('  stop-vnc'));
  console.log('');

  console.log(chalk.bold('🔑 To Change VNC Password'));
  console.log('  Inside the container, run:');
  console.log(chalk.cyan('  vncpasswd'));
  console.log('');

  console.log(chalk.dim('For more details, see: docs/vnc-browser-monitoring.md'));
}
