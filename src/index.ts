import { cleanupCommand } from '@commands/cleanup';
import { connectCommand } from '@commands/connect';
import { connectAsRootCommand } from '@commands/connect-as-root';
import { logsCommand } from '@commands/logs';
import { rebuildCommand } from '@commands/rebuild';
import { setupCommand } from '@commands/setup';
import { startCommand } from '@commands/start';
import { statusCommand } from '@commands/status';
import { stopCommand } from '@commands/stop';
import { vnc } from '@commands/vnc';
import { cursorCommand, vscodeCommand } from '@commands/vscode';
import { CONSTANTS } from '@config/constants';
import { logger } from '@utils/logger';
import chalk from 'chalk';
import { Command } from 'commander';

const program = new Command();

program
  .name('devvy')
  .description('Devvy - Development Environment CLI')
  .version(CONSTANTS.VERSION)
  .option('-v, --verbose', 'Enable verbose output')
  .option('--debug', 'Enable debug output')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().verbose) {
      process.env.LOG_LEVEL = 'info';
    }
    if (thisCommand.opts().debug) {
      process.env.LOG_LEVEL = 'debug';
    }
  });

program
  .command('start')
  .description('Start the development container')
  .option('-b, --build', 'Build the image before starting')
  .option('-d, --detach', 'Run container in background')
  .action(async (options) => {
    await startCommand(options);
  });

program
  .command('stop')
  .description('Stop the development container')
  .option('-f, --force', 'Force stop the container')
  .action(async (options) => {
    await stopCommand(options);
  });

program
  .command('connect')
  .description('Connect to the development container')
  .option('-m, --mosh', 'Use mosh instead of SSH')
  .option('-t, --tmux', 'Connect to tmux session')
  .action(async (options) => {
    await connectCommand(options);
  });

program
  .command('connect-as-root')
  .description('Connect to the development container as root user via Docker exec')
  .option('-t, --tmux', 'Connect to tmux session')
  .action(async (options) => {
    await connectAsRootCommand(options);
  });

program
  .command('status')
  .description('Show container status')
  .option('-j, --json', 'Output in JSON format')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    await statusCommand(options);
  });

program
  .command('logs')
  .description('Show container logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --tail <lines>', 'Number of lines to show from the end')
  .option('-t, --timestamps', 'Show timestamps')
  .option('--since <time>', 'Show logs since timestamp (e.g., 10m, 1h, 2023-01-01)')
  .option('--until <time>', 'Show logs before timestamp')
  .action(async (options) => {
    await logsCommand(options);
  });

program
  .command('rebuild')
  .alias('build')
  .description('Rebuild the container image')
  .option('--no-cache', 'Build without cache')
  .option('-f, --force', 'Force rebuild even if container is running')
  .action(async (options) => {
    await rebuildCommand(options);
  });

program
  .command('cleanup')
  .description('Clean up Docker resources')
  .option('-a, --all', 'Remove all containers, images, and volumes')
  .option('--dry-run', 'Show what would be removed without removing')
  .option('-f, --force', 'Skip confirmation prompts')
  .action(async (options) => {
    await cleanupCommand(options);
  });

program
  .command('setup')
  .alias('init')
  .description('Initial setup and configuration')
  .action(async () => {
    await setupCommand();
  });

program
  .command('cursor')
  .description('Launch Cursor and attach to the container as devvy user')
  .option('-f, --folder <path>', 'Folder to open in the container (default: /home/devvy)')
  .action(async (options) => {
    await cursorCommand(options);
  });

program
  .command('vscode')
  .alias('code')
  .description('Launch VS Code and attach to the container as devvy user')
  .option('-f, --folder <path>', 'Folder to open in the container (default: /home/devvy)')
  .action(async (options) => {
    await vscodeCommand(options);
  });

program
  .command('vnc')
  .description('Show VNC connection instructions for browser monitoring')
  .action(async () => {
    await vnc();
  });

program.addHelpText(
  'after',
  `
${chalk.gray('Examples:')}
  $ devvy start           ${chalk.gray('# Start the development container')}
  $ devvy connect         ${chalk.gray('# Connect to the container via SSH')}
  $ devvy stop            ${chalk.gray('# Stop the container')}
  $ devvy status          ${chalk.gray('# Show container status')}
  $ devvy logs -f         ${chalk.gray('# Follow container logs')}

${chalk.gray('For more information, visit:')} ${chalk.blue('https://github.com/ykka/clade-devvy-container')}
`,
);

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error('Unexpected error', error);
    process.exit(1);
  }
}

void main();

export { program };
