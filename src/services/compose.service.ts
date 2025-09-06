import * as path from 'node:path'

import type { DockerComposeConfig } from '@config/schema'
import { logger } from '@utils/logger'
import { Shell } from '@utils/shell'
import { execa, type ExecaChildProcess } from 'execa'
import * as fs from 'fs-extra'
import * as yaml from 'yaml'


import { ConfigService } from './config.service'


export interface ComposeOptions {
  projectName?: string
  file?: string
  env?: Record<string, string>
}

export class ComposeService {
  private static instance: ComposeService
  private config: ConfigService

  private constructor() {
    this.config = ConfigService.getInstance()
  }

  public static getInstance(): ComposeService {
    if (!ComposeService.instance) {
      ComposeService.instance = new ComposeService()
    }
    return ComposeService.instance
  }

  private getComposeCommand(options: ComposeOptions = {}): string[] {
    const dockerConfig = this.config.getDockerConfig()
    const command = ['docker', 'compose']

    if (options.projectName || dockerConfig.projectName) {
      command.push('-p', options.projectName || dockerConfig.projectName)
    }

    if (options.file || dockerConfig.composeFile) {
      command.push('-f', options.file || dockerConfig.composeFile)
    }

    return command
  }

  public async run(args: string[]): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return Shell.exec('docker', ['compose', ...args])
  }

  public async up(
    options: ComposeOptions & { detach?: boolean; build?: boolean } = {}
  ): Promise<boolean> {
    try {
      const command = this.getComposeCommand(options)
      command.push('up')

      if (options.detach) {
        command.push('-d')
      }

      if (options.build) {
        command.push('--build')
      }

      logger.command(command.join(' '))

      const result = await execa(command[0]!, command.slice(1), {
        env: options.env,
        stdio: options.detach ? 'pipe' : 'inherit',
      })

      if (result.exitCode === 0) {
        logger.success('Docker Compose up completed successfully')
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to run docker-compose up', error)
      return false
    }
  }

  public async down(
    options: ComposeOptions & { volumes?: boolean; removeOrphans?: boolean } = {}
  ): Promise<boolean> {
    try {
      const command = this.getComposeCommand(options)
      command.push('down')

      if (options.volumes) {
        command.push('-v')
      }

      if (options.removeOrphans) {
        command.push('--remove-orphans')
      }

      logger.command(command.join(' '))

      const result = await execa(command[0]!, command.slice(1), {
        env: options.env,
        stdio: 'inherit',
      })

      if (result.exitCode === 0) {
        logger.success('Docker Compose down completed successfully')
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to run docker-compose down', error)
      return false
    }
  }

  public async build(
    options: ComposeOptions & { noCache?: boolean; pull?: boolean } = {}
  ): Promise<boolean> {
    try {
      const command = this.getComposeCommand(options)
      command.push('build')

      if (options.noCache) {
        command.push('--no-cache')
      }

      if (options.pull) {
        command.push('--pull')
      }

      logger.command(command.join(' '))

      const result = await execa(command[0]!, command.slice(1), {
        env: options.env,
        stdio: 'inherit',
      })

      if (result.exitCode === 0) {
        logger.success('Docker Compose build completed successfully')
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to run docker-compose build', error)
      return false
    }
  }

  public async restart(options: ComposeOptions & { service?: string } = {}): Promise<boolean> {
    try {
      const command = this.getComposeCommand(options)
      command.push('restart')

      if (options.service) {
        command.push(options.service)
      }

      logger.command(command.join(' '))

      const result = await execa(command[0]!, command.slice(1), {
        env: options.env,
        stdio: 'inherit',
      })

      if (result.exitCode === 0) {
        logger.success('Docker Compose restart completed successfully')
        return true
      }

      return false
    } catch (error) {
      logger.error('Failed to run docker-compose restart', error)
      return false
    }
  }

  public async logs(
    options: ComposeOptions & { follow?: boolean; tail?: string; service?: string } = {}
  ): Promise<ExecaChildProcess | null> {
    try {
      const command = this.getComposeCommand(options)
      command.push('logs')

      if (options.follow) {
        command.push('-f')
      }

      if (options.tail) {
        command.push('--tail', options.tail)
      }

      if (options.service) {
        command.push(options.service)
      }

      logger.command(command.join(' '))

      const process = execa(command[0]!, command.slice(1), {
        env: options.env,
        stdio: 'inherit',
      })

      return process
    } catch (error) {
      logger.error('Failed to run docker-compose logs', error)
      return null
    }
  }

  public async exec(
    service: string,
    command: string[],
    options: ComposeOptions & { interactive?: boolean; tty?: boolean } = {}
  ): Promise<boolean> {
    try {
      const composeCommand = this.getComposeCommand(options)
      composeCommand.push('exec')

      if (!options.interactive) {
        composeCommand.push('-T')
      }

      composeCommand.push(service, ...command)

      logger.command(composeCommand.join(' '))

      const result = await execa(composeCommand[0]!, composeCommand.slice(1), {
        env: options.env,
        stdio: 'inherit',
      })

      return result.exitCode === 0
    } catch (error) {
      logger.error('Failed to run docker-compose exec', error)
      return false
    }
  }

  public async ps(options: ComposeOptions = {}): Promise<string> {
    try {
      const command = this.getComposeCommand(options)
      command.push('ps')

      const result = await execa(command[0]!, command.slice(1), {
        env: options.env,
      })

      return result.stdout
    } catch (error) {
      logger.error('Failed to run docker-compose ps', error)
      return ''
    }
  }

  public async loadComposeFile(filePath?: string): Promise<DockerComposeConfig | null> {
    try {
      const dockerConfig = this.config.getDockerConfig()
      const composeFilePath = filePath || dockerConfig.composeFile
      const fullPath = path.isAbsolute(composeFilePath)
        ? composeFilePath
        : path.join(process.cwd(), composeFilePath)

      if (!(await fs.pathExists(fullPath))) {
        logger.error(`Docker Compose file not found: ${fullPath}`)
        return null
      }

      const content = await fs.readFile(fullPath, 'utf8')
      const parsed = yaml.parse(content) as DockerComposeConfig

      return parsed
    } catch (error) {
      logger.error('Failed to load Docker Compose file', error)
      return null
    }
  }

  public async saveComposeFile(config: DockerComposeConfig, filePath?: string): Promise<boolean> {
    try {
      const dockerConfig = this.config.getDockerConfig()
      const composeFilePath = filePath || dockerConfig.composeFile
      const fullPath = path.isAbsolute(composeFilePath)
        ? composeFilePath
        : path.join(process.cwd(), composeFilePath)

      const yamlContent = yaml.stringify(config)
      await fs.writeFile(fullPath, yamlContent, 'utf-8')

      logger.success(`Docker Compose file saved to ${fullPath}`)
      return true
    } catch (error) {
      logger.error('Failed to save Docker Compose file', error)
      return false
    }
  }

  public async isServiceRunning(service: string, options: ComposeOptions = {}): Promise<boolean> {
    try {
      const psOutput = await this.ps(options)
      return psOutput.includes(service) && psOutput.includes('Up')
    } catch {
      return false
    }
  }
}
