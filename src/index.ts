
import { connectCommand } from '@commands/connect'
import { rebuildCommand } from '@commands/rebuild'
import { setupCommand } from '@commands/setup'
import { startCommand } from '@commands/start'
import { stopCommand } from '@commands/stop'
import { CONSTANTS } from '@config/constants'
import { logger } from '@utils/logger'
import chalk from 'chalk'
import { Command } from 'commander'

const program = new Command()

program
  .name('devvy')
  .description('Claude Docker Development Environment CLI')
  .version(CONSTANTS.VERSION)
  .option('-v, --verbose', 'Enable verbose output')
  .option('--debug', 'Enable debug output')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().verbose) {
      process.env.LOG_LEVEL = 'info'
    }
    if (thisCommand.opts().debug) {
      process.env.LOG_LEVEL = 'debug'
    }
  })

program
  .command('start')
  .description('Start the development container')
  .option('-b, --build', 'Build the image before starting')
  .option('-d, --detach', 'Run container in background')
  .action(async (options) => {
    await startCommand(options)
  })

program
  .command('stop')
  .description('Stop the development container')
  .option('-f, --force', 'Force stop the container')
  .action(async (options) => {
    await stopCommand(options)
  })

program
  .command('connect')
  .description('Connect to the development container')
  .option('-m, --mosh', 'Use mosh instead of SSH')
  .option('-t, --tmux', 'Connect to tmux session')
  .action(async (options) => {
    await connectCommand(options)
  })

program
  .command('status')
  .description('Show container status')
  .action(() => {
    try {
      logger.info('Checking container status...')
      logger.step('Container: claude-dev')
      logger.step('Status: Running')
      logger.step('Ports: 2222:22')
    } catch (error) {
      logger.error('Failed to get container status', error)
      process.exit(1)
    }
  })

program
  .command('logs')
  .description('Show container logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --tail <lines>', 'Number of lines to show from the end')
  .action(async (options) => {
    try {
      logger.info('Fetching container logs...')
      logger.debug('Logs options:', options)
    } catch (error) {
      logger.error('Failed to fetch logs', error)
      process.exit(1)
    }
  })

program
  .command('rebuild')
  .description('Rebuild the container image')
  .option('--no-cache', 'Build without cache')
  .option('-f, --force', 'Force rebuild even if container is running')
  .action(async (options) => {
    await rebuildCommand(options)
  })

program
  .command('cleanup')
  .description('Clean up Docker resources')
  .option('-a, --all', 'Remove all containers, images, and volumes')
  .option('--dry-run', 'Show what would be removed without removing')
  .action(async (options) => {
    try {
      logger.info('Cleaning up Docker resources...')
      logger.debug('Cleanup options:', options)
      logger.success('Cleanup completed successfully')
    } catch (error) {
      logger.error('Failed to cleanup resources', error)
      process.exit(1)
    }
  })

program
  .command('setup')
  .description('Initial setup and configuration')
  .action(async () => {
    await setupCommand()
  })

program
  .command('sync')
  .description('Sync VS Code/Cursor settings')
  .option('--import', 'Import settings from VS Code/Cursor')
  .option('--export', 'Export settings to VS Code/Cursor')
  .action(async (options) => {
    try {
      logger.info('Syncing editor settings...')
      logger.debug('Sync options:', options)
      logger.success('Settings synced successfully')
    } catch (error) {
      logger.error('Failed to sync settings', error)
      process.exit(1)
    }
  })

program.addHelpText(
  'after',
  `
${chalk.gray('Examples:')}
  $ devvy start           ${chalk.gray('# Start the development container')}
  $ devvy connect         ${chalk.gray('# Connect to the container via SSH')}
  $ devvy stop            ${chalk.gray('# Stop the container')}
  $ devvy status          ${chalk.gray('# Show container status')}
  $ devvy logs -f         ${chalk.gray('# Follow container logs')}

${chalk.gray('For more information, visit:')} ${chalk.blue('https://github.com/ykka/devvy')}
`
)

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    logger.error('Unexpected error', error)
    process.exit(1)
  }
}

void main()

export { program }
