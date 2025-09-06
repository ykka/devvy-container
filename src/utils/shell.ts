import { execa, type ExecaChildProcess, type Options as ExecaOptions } from 'execa'
import which from 'which'

import { logger } from './logger'

export interface ShellResult {
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

export class Shell {
  public static async exec(
    command: string,
    args: string[] = [],
    options: ExecaOptions = {}
  ): Promise<ShellResult> {
    try {
      logger.debug(`Executing: ${command} ${args.join(' ')}`)

      const result = await execa(command, args, {
        ...options,
        reject: false,
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.exitCode === 0,
      }
    } catch (error) {
      logger.error(`Command failed: ${command}`, error)
      throw error
    }
  }

  public static async execInteractive(
    command: string,
    args: string[] = [],
    options: ExecaOptions = {}
  ): Promise<number> {
    try {
      logger.debug(`Executing interactive: ${command} ${args.join(' ')}`)

      const result = await execa(command, args, {
        ...options,
        stdio: 'inherit',
        reject: false,
      })

      return result.exitCode
    } catch (error) {
      logger.error(`Interactive command failed: ${command}`, error)
      throw error
    }
  }

  public static spawn(
    command: string,
    args: string[] = [],
    options: ExecaOptions = {}
  ): ExecaChildProcess {
    logger.debug(`Spawning: ${command} ${args.join(' ')}`)

    return execa(command, args, {
      ...options,
      buffer: false,
    })
  }

  public static async commandExists(command: string): Promise<boolean> {
    try {
      await which(command)
      return true
    } catch {
      return false
    }
  }

  public static async requireCommand(command: string, message?: string): Promise<void> {
    if (!(await this.commandExists(command))) {
      const errorMessage = message || `Required command '${command}' is not installed`
      logger.error(errorMessage)
      throw new Error(errorMessage)
    }
  }

  public static async getCommandPath(command: string): Promise<string | null> {
    try {
      return await which(command)
    } catch {
      return null
    }
  }
}
