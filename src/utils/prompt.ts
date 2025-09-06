import chalk from 'chalk'
import inquirer from 'inquirer'

export interface PromptOptions {
  message: string
  default?: string | boolean | number
}

export class Prompt {
  public static async confirm(message: string, defaultValue = false): Promise<boolean> {
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message,
        default: defaultValue,
      },
    ])

    return confirmed
  }

  public static async input(options: PromptOptions): Promise<string> {
    const { value } = await inquirer.prompt<{ value: string }>([
      {
        type: 'input',
        name: 'value',
        message: options.message,
        default: options.default as string | undefined,
      },
    ])

    return value
  }

  public static async password(options: { message: string; mask?: string }): Promise<string> {
    const { password } = await inquirer.prompt<{ password: string }>([
      {
        type: 'password',
        name: 'password',
        message: options.message,
        mask: options.mask || '*',
      },
    ])

    return password
  }

  public static async select<T = string>(
    message: string,
    choices: Array<{ name: string; value: T }>
  ): Promise<T> {
    const { selected } = await inquirer.prompt<{ selected: T }>([
      {
        type: 'list',
        name: 'selected',
        message,
        choices,
      },
    ])

    return selected
  }

  public static async multiSelect<T = string>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean }>
  ): Promise<T[]> {
    const { selected } = await inquirer.prompt<{ selected: T[] }>([
      {
        type: 'checkbox',
        name: 'selected',
        message,
        choices,
      },
    ])

    return selected
  }

  public static async number(
    options: PromptOptions & { min?: number; max?: number }
  ): Promise<number> {
    const { value } = await inquirer.prompt<{ value: number }>([
      {
        type: 'number',
        name: 'value',
        message: options.message,
        default: options.default as number | undefined,
        validate: (input: number) => {
          if (options.min !== undefined && input < options.min) {
            return `Value must be at least ${options.min}`
          }
          if (options.max !== undefined && input > options.max) {
            return `Value must be at most ${options.max}`
          }
          return true
        },
      },
    ])

    return value
  }

  public static async path(
    message: string,
    options: { exists?: boolean; isFile?: boolean; isDirectory?: boolean } = {}
  ): Promise<string> {
    const { value } = await inquirer.prompt<{ value: string }>([
      {
        type: 'input',
        name: 'value',
        message,
        validate: async (input: string) => {
          if (!input) {
            return 'Path is required'
          }

          const fs = await import('fs-extra')

          if (options.exists && !(await fs.pathExists(input))) {
            return `Path does not exist: ${input}`
          }

          if (options.isFile && !(await fs.stat(input)).isFile()) {
            return `Path is not a file: ${input}`
          }

          if (options.isDirectory && !(await fs.stat(input)).isDirectory()) {
            return `Path is not a directory: ${input}`
          }

          return true
        },
      },
    ])

    return value
  }

  public static showMessage(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ): void {
    const prefix = {
      info: chalk.blue('ℹ'),
      success: chalk.green('✓'),
      warning: chalk.yellow('⚠'),
      error: chalk.red('✗'),
    }

    console.log(`${prefix[type]} ${message}`)
  }
}
