import * as path from 'node:path'

import { ComposeService } from '@services/compose.service'
import { ConfigService } from '@services/config.service'
import { DockerService } from '@services/docker.service'
import { logger } from '@utils/logger'
import { Prompt } from '@utils/prompt'
import { Spinner } from '@utils/spinner'
import chalk from 'chalk'
import * as fs from 'fs-extra'

interface RebuildOptions {
  noCache?: boolean
  force?: boolean
}

export async function rebuildCommand(options: RebuildOptions): Promise<void> {
  try {
    const config = ConfigService.getInstance()
    const docker = DockerService.getInstance()
    const compose = ComposeService.getInstance()
    const containerName = config.getDockerConfig().containerName

    // Check if container is running
    const containerInfo = await docker.getContainer(containerName)
    const isRunning = containerInfo ? await docker.isRunning(containerName) : false
    
    if (isRunning && !options.force) {
      const shouldStop = await Prompt.confirm(
        'Container is running. Stop it before rebuilding?',
        true
      )
      if (!shouldStop) {
        logger.info('Rebuild cancelled')
        return
      }
    }

    // Step 1: Stop container if running
    if (isRunning) {
      const spinner = new Spinner('Stopping container...')
      spinner.start()
      await docker.stopContainer(containerName, options.force)
      spinner.succeed('Container stopped')
    }

    // Step 2: Get current SSH host key before rebuild (if container exists)
    let oldHostKey: string | null = null
    if (containerInfo) {
      const spinner = new Spinner('Retrieving current SSH host key...')
      spinner.start()
      try {
        const result = await docker.exec(containerName, [
          'ssh-keygen',
          '-lf',
          '/etc/ssh/ssh_host_ed25519_key.pub'
        ])
        if (result.success) {
          oldHostKey = result.stdout.trim()
          spinner.succeed('Current SSH host key retrieved')
        } else {
          spinner.warn('Could not retrieve current SSH host key')
        }
      } catch {
        spinner.warn('Container not accessible for SSH key retrieval')
      }
    }

    // Step 3: Remove old container
    if (containerInfo) {
      const spinner = new Spinner('Removing old container...')
      spinner.start()
      await docker.removeContainer(containerName, true)
      spinner.succeed('Old container removed')
    }

    // Step 4: Build new image
    const buildSpinner = new Spinner('Building new container image...')
    buildSpinner.start()
    
    const buildArgs = ['build']
    if (options.noCache) {
      buildArgs.push('--no-cache')
    }
    
    const buildResult = await compose.run(buildArgs)
    if (!buildResult.success) {
      buildSpinner.fail('Failed to build container image')
      logger.error(buildResult.stderr)
      process.exit(1)
    }
    
    buildSpinner.succeed('Container image rebuilt successfully')

    // Step 5: Start new container
    const startSpinner = new Spinner('Starting new container...')
    startSpinner.start()
    
    const startResult = await compose.up({ detach: true })
    if (!startResult) {
      startSpinner.fail('Failed to start container')
      process.exit(1)
    }
    
    startSpinner.succeed('Container started')

    // Step 6: Wait for SSH to be ready
    const sshSpinner = new Spinner('Waiting for SSH service...')
    sshSpinner.start()
    
    let sshReady = false
    let attempts = 0
    const maxAttempts = 30
    
    while (!sshReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        const result = await docker.exec(containerName, ['true'])
        if (result.success) {
          sshReady = true
        }
      } catch {
        // Container not ready yet
      }
      attempts++
    }
    
    if (!sshReady) {
      sshSpinner.fail('SSH service did not start in time')
      process.exit(1)
    }
    
    sshSpinner.succeed('SSH service ready')

    // Step 7: Get new SSH host key
    const keySpinner = new Spinner('Getting new SSH host key...')
    keySpinner.start()
    
    const newKeyResult = await docker.exec(containerName, [
      'ssh-keygen',
      '-lf',
      '/etc/ssh/ssh_host_ed25519_key.pub'
    ])
    
    if (newKeyResult.success) {
      const newHostKey = newKeyResult.stdout.trim()
      keySpinner.succeed('New SSH host key retrieved')
      
      // Step 8: Update known_hosts file
      if (oldHostKey && oldHostKey !== newHostKey) {
        await updateKnownHosts(oldHostKey, newHostKey)
      }
      
      logger.info('\nNew SSH host key fingerprint:')
      logger.info(chalk.cyan(newHostKey))
    } else {
      keySpinner.fail('Failed to get new SSH host key')
      logger.error(newKeyResult.stderr)
    }

    // Step 9: Verify container is healthy
    const healthSpinner = new Spinner('Verifying container health...')
    healthSpinner.start()
    
    const isHealthy = await docker.isRunning(containerName)
    if (isHealthy) {
      healthSpinner.succeed('Container is healthy and running')
    } else {
      healthSpinner.fail('Container health check failed')
      process.exit(1)
    }

    logger.success('\n✨ Container rebuilt successfully!')
    logger.info('\nYou can now connect to the container:')
    logger.step(`${chalk.cyan('devvy connect')} - Connect via SSH`)
    logger.step(`${chalk.cyan('devvy connect -m')} - Connect via Mosh`)
  } catch (error) {
    logger.error('Failed to rebuild container', error)
    process.exit(1)
  }
}

async function updateKnownHosts(_oldKey: string, _newKey: string): Promise<void> {
  const spinner = new Spinner('Updating SSH known_hosts...')
  spinner.start()
  
  try {
    const knownHostsPath = path.join(process.env.HOME || '', '.ssh', 'known_hosts')
    
    if (!(await fs.pathExists(knownHostsPath))) {
      spinner.warn('No known_hosts file found')
      return
    }
    
    // Read the current known_hosts
    const content = await fs.readFile(knownHostsPath, 'utf8')
    
    // Extract the fingerprint from the old key (format: "256 SHA256:xxxxx comment")
    // const oldFingerprint = oldKey.split(' ')[1]
    
    // Find and remove lines for our container
    const lines = content.split('\n')
    const filteredLines = lines.filter(line => {
      // Check if this line is for our container (port 2222)
      if (line.includes('[localhost]:2222') || line.includes('[127.0.0.1]:2222')) {
        // This is our container's entry, remove it
        return false
      }
      return true
    })
    
    // Write back the filtered content
    await fs.writeFile(knownHostsPath, filteredLines.join('\n'))
    
    spinner.succeed('SSH known_hosts updated (old entry removed)')
    logger.info(chalk.yellow('\n⚠️  You will be prompted to verify the new host key on next connection'))
  } catch {
    spinner.fail('Failed to update known_hosts')
    logger.warn('You may need to manually remove the old host key from ~/.ssh/known_hosts')
    logger.warn(`Look for entries with [localhost]:2222 or [127.0.0.1]:2222`)
  }
}