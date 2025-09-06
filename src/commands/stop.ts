import { ComposeService } from '@services/compose.service'
import { ConfigService } from '@services/config.service'
import { DockerService } from '@services/docker.service'
import { logger } from '@utils/logger'
import { Prompt } from '@utils/prompt'
import { Spinner } from '@utils/spinner'

export interface StopOptions {
  force?: boolean
}

export async function stopCommand(options: StopOptions): Promise<void> {
  const dockerService = DockerService.getInstance()
  const composeService = ComposeService.getInstance()
  const config = ConfigService.getInstance()

  try {
    const containerName = config.getDockerConfig().containerName
    const containerInfo = await dockerService.getContainerInfo(containerName)

    if (!containerInfo || containerInfo.state !== 'running') {
      logger.info('Container is not running')
      return
    }

    if (!options.force) {
      const confirmed = await Prompt.confirm(
        'Are you sure you want to stop the development container?',
        true
      )

      if (!confirmed) {
        logger.info('Stop operation cancelled')
        return
      }
    }

    const spinner = new Spinner('Stopping container...')
    spinner.start()

    const success = await composeService.down()

    if (success) {
      spinner.succeed('Container stopped successfully')
    } else {
      const forceStop = await dockerService.stopContainer(containerName, true)
      if (forceStop) {
        spinner.succeed('Container force-stopped successfully')
      } else {
        spinner.fail('Failed to stop container')
        process.exit(1)
      }
    }
  } catch (error) {
    logger.error('Failed to stop container', error)
    process.exit(1)
  }
}
