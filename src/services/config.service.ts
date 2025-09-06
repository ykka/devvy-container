import * as path from 'node:path'

import { CONSTANTS } from '@config/constants'
import { DEFAULT_CONFIG } from '@config/defaults'
import { configSchema, envSchema, type AppConfig, type EnvConfig } from '@config/schema'
import * as dotenv from 'dotenv'
import * as fs from 'fs-extra'
import { z } from 'zod'

export class ConfigService {
  private static instance: ConfigService
  private config: AppConfig
  private envConfig: EnvConfig

  private constructor() {
    this.config = DEFAULT_CONFIG
    this.envConfig = this.loadEnvConfig()
    this.loadConfig()
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService()
    }
    return ConfigService.instance
  }

  private loadEnvConfig(): EnvConfig {
    dotenv.config({ path: CONSTANTS.PATHS.ENV_FILE })

    if (fs.existsSync(CONSTANTS.PATHS.ENV_LOCAL)) {
      dotenv.config({ path: CONSTANTS.PATHS.ENV_LOCAL, override: true })
    }

    try {
      return envSchema.parse(process.env)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid environment configuration:', error.errors)
      }
      throw error
    }
  }

  private loadConfig(): void {
    const configPath = path.join(process.cwd(), '.claude-docker.json')

    if (fs.existsSync(configPath)) {
      try {
        const userConfig = fs.readJsonSync(configPath) as unknown
        const validatedConfig = configSchema.parse(userConfig)
        this.config = { ...DEFAULT_CONFIG, ...validatedConfig }
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Invalid configuration file:', error.errors)
        }
        throw error
      }
    }
  }

  public get(): AppConfig {
    return this.config
  }

  public getEnv(): EnvConfig {
    return this.envConfig
  }

  public getDockerConfig(): AppConfig['docker'] {
    return this.config.docker
  }

  public getSshConfig(): AppConfig['ssh'] {
    return this.config.ssh
  }

  public getWorkspaceConfig(): AppConfig['workspace'] {
    return this.config.workspace
  }

  public getVscodeConfig(): AppConfig['vscode'] {
    return this.config.vscode
  }

  public getLoggingConfig(): AppConfig['logging'] {
    return this.config.logging
  }

  public async saveConfig(config: Partial<AppConfig>): Promise<void> {
    const configPath = path.join(process.cwd(), '.claude-docker.json')
    const mergedConfig = { ...this.config, ...config }

    try {
      const validatedConfig = configSchema.parse(mergedConfig)
      await fs.writeJson(configPath, validatedConfig, { spaces: 2 })
      this.config = validatedConfig
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Invalid configuration:', error.errors)
      }
      throw error
    }
  }

  public getProjectRoot(): string {
    return process.cwd()
  }

  public getAbsolutePath(relativePath: string): string {
    return path.join(this.getProjectRoot(), relativePath)
  }
}
