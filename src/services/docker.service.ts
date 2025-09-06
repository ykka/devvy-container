import { logger } from '@utils/logger'
import Docker from 'dockerode'

export interface ContainerInfo {
  id: string
  name: string
  state: string
  status: string
  image: string
  ports: Array<{
    private: number
    public: number
    type: string
  }>
  created: Date
}

export class DockerService {
  private static instance: DockerService
  private docker: Docker

  private constructor() {
    this.docker = new Docker()
  }

  public static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService()
    }
    return DockerService.instance
  }

  public async isDockerRunning(): Promise<boolean> {
    try {
      await this.docker.ping()
      return true
    } catch {
      return false
    }
  }

  public async getContainer(name: string): Promise<Docker.Container | null> {
    try {
      const containers = await this.docker.listContainers({ all: true })
      const container = containers.find(
        (c) => c.Names.includes(`/${name}`) || c.Id === name
      )

      if (container) {
        return this.docker.getContainer(container.Id)
      }
      return null
    } catch (error) {
      logger.error('Failed to get container', error)
      return null
    }
  }

  public async getContainerInfo(name: string): Promise<ContainerInfo | null> {
    try {
      const container = await this.getContainer(name)
      if (!container) {
        return null
      }

      const info = await container.inspect()

      return {
        id: info.Id,
        name: info.Name.replace(/^\//, ''),
        state: info.State.Status,
        status: info.State.Running ? 'Running' : 'Stopped',
        image: info.Config.Image,
        ports: Object.entries(info.NetworkSettings.Ports || {}).map(([key, value]) => {
          const [privatePort, type] = key.split('/')
          const publicPort = value?.[0]?.HostPort
          return {
            private: Number.parseInt(privatePort ?? '0', 10),
            public: publicPort ? Number.parseInt(publicPort, 10) : 0,
            type: type || 'tcp',
          }
        }),
        created: new Date(info.Created),
      }
    } catch (error) {
      logger.error('Failed to get container info', error)
      return null
    }
  }

  public async startContainer(name: string): Promise<boolean> {
    try {
      const container = await this.getContainer(name)
      if (!container) {
        logger.error(`Container ${name} not found`)
        return false
      }

      const info = await container.inspect()
      if (info.State.Running) {
        logger.info('Container is already running')
        return true
      }

      await container.start()
      logger.success(`Container ${name} started successfully`)
      return true
    } catch (error) {
      logger.error('Failed to start container', error)
      return false
    }
  }

  public async stopContainer(name: string, force = false): Promise<boolean> {
    try {
      const container = await this.getContainer(name)
      if (!container) {
        logger.error(`Container ${name} not found`)
        return false
      }

      const info = await container.inspect()
      if (!info.State.Running) {
        logger.info('Container is already stopped')
        return true
      }

      await (force ? container.kill() : container.stop());

      logger.success(`Container ${name} stopped successfully`)
      return true
    } catch (error) {
      logger.error('Failed to stop container', error)
      return false
    }
  }

  public async isRunning(name: string): Promise<boolean> {
    try {
      const container = await this.getContainer(name)
      if (!container) {
        return false
      }
      const info = await container.inspect()
      return info.State.Running
    } catch {
      return false
    }
  }

  public async removeContainer(name: string, force = false): Promise<boolean> {
    try {
      const container = await this.getContainer(name)
      if (!container) {
        logger.info(`Container ${name} not found`)
        return true
      }

      await container.remove({ force })
      logger.success(`Container ${name} removed successfully`)
      return true
    } catch (error) {
      logger.error('Failed to remove container', error)
      return false
    }
  }

  public async getContainerLogs(
    name: string,
    options: { follow?: boolean; tail?: number } = {}
  ): Promise<NodeJS.ReadableStream | null> {
    try {
      const container = await this.getContainer(name)
      if (!container) {
        logger.error(`Container ${name} not found`)
        return null
      }

      const stream = container.logs({
        stdout: true,
        stderr: true,
        follow: options.follow || false,
        tail: options.tail || 'all',
      } as any)

      return stream as any
    } catch (error) {
      logger.error('Failed to get container logs', error)
      return null
    }
  }

  public async exec(
    containerName: string,
    command: string[]
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    try {
      const container = await this.getContainer(containerName)
      if (!container) {
        return {
          success: false,
          stdout: '',
          stderr: `Container ${containerName} not found`
        }
      }

      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: false,
        Tty: false
      } as any)

      const stream = await exec.start({} as any)
      
      let stdout = ''
      const stderr = ''
      
      return new Promise((resolve) => {
        stream.on('data', (chunk: Buffer) => {
          const data = chunk.toString()
          // Docker stream multiplexing - first 8 bytes are header
          // We'll just capture all output for simplicity
          stdout += data
        })
        
        stream.on('end', async () => {
          const info = await exec.inspect()
          resolve({
            success: info.ExitCode === 0,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          })
        })
        
        stream.on('error', (err: Error) => {
          resolve({
            success: false,
            stdout: '',
            stderr: err.message
          })
        })
      })
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  public async execCommand(
    containerName: string,
    command: string[],
    options: { interactive?: boolean; tty?: boolean } = {}
  ): Promise<{ exitCode: number; output: string }> {
    try {
      const container = await this.getContainer(containerName)
      if (!container) {
        throw new Error(`Container ${containerName} not found`)
      }

      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: options.interactive || false,
        Tty: options.tty || false,
      })

      const stream = await exec.start({
        hijack: options.interactive || false,
        stdin: options.interactive || false,
      })

      return new Promise((resolve, reject) => {
        let output = ''

        stream.on('data', (chunk: Buffer) => {
          output += chunk.toString()
        })

        stream.on('end', async () => {
          const inspectInfo = await exec.inspect()
          resolve({
            exitCode: inspectInfo.ExitCode || 0,
            output,
          })
        })

        stream.on('error', reject)
      })
    } catch (error) {
      logger.error('Failed to execute command in container', error)
      throw error
    }
  }

  public async listContainers(all = false): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all })

      return containers.map((container) => ({
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') || '',
        state: container.State,
        status: container.Status,
        image: container.Image,
        ports: container.Ports.map((port) => ({
          private: port.PrivatePort,
          public: port.PublicPort || 0,
          type: port.Type,
        })),
        created: new Date(container.Created * 1000),
      }))
    } catch (error) {
      logger.error('Failed to list containers', error)
      return []
    }
  }

  public async pruneSystem(): Promise<void> {
    try {
      logger.info('Pruning unused Docker resources...')
      await this.docker.pruneContainers()
      await this.docker.pruneImages()
      await this.docker.pruneVolumes()
      logger.success('Docker system pruned successfully')
    } catch (error) {
      logger.error('Failed to prune Docker system', error)
      throw error
    }
  }
}
