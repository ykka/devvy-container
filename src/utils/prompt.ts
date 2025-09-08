import chalk from 'chalk';
import inquirer from 'inquirer';

export interface PromptOptions {
  message: string;
  default?: string | boolean | number;
}

export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
      prefix: '', // Remove the '?' prefix
    },
  ]);

  return confirmed;
}

export async function input(options: PromptOptions): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message: options.message,
      default: options.default as string | undefined,
      prefix: '', // Remove the '?' prefix
    },
  ]);

  return value;
}

export async function password(options: { message: string; mask?: string }): Promise<string> {
  const { password } = await inquirer.prompt<{ password: string }>([
    {
      type: 'password',
      name: 'password',
      message: options.message,
      mask: options.mask || '*',
      prefix: '', // Remove the '?' prefix
    },
  ]);

  return password;
}

export async function select<T = string>(message: string, choices: Array<{ name: string; value: T }>): Promise<T> {
  const { selected } = await inquirer.prompt<{ selected: T }>([
    {
      type: 'list',
      name: 'selected',
      message,
      choices,
      prefix: '', // Remove the '?' prefix
    },
  ]);

  return selected;
}

export async function multiSelect<T = string>(message: string, choices: Array<{ name: string; value: T; checked?: boolean }>): Promise<T[]> {
  const { selected } = await inquirer.prompt<{ selected: T[] }>([
    {
      type: 'checkbox',
      name: 'selected',
      message,
      choices,
      prefix: '', // Remove the '?' prefix
    },
  ]);

  return selected;
}

export async function number(options: PromptOptions & { min?: number; max?: number }): Promise<number> {
  const { value } = await inquirer.prompt<{ value: number }>([
    {
      type: 'number',
      name: 'value',
      message: options.message,
      default: options.default as number | undefined,
      prefix: '', // Remove the '?' prefix
      validate: (input: number) => {
        if (options.min !== undefined && input < options.min) {
          return `Value must be at least ${options.min}`;
        }
        if (options.max !== undefined && input > options.max) {
          return `Value must be at most ${options.max}`;
        }
        return true;
      },
    },
  ]);

  return value;
}

export async function path(message: string, options: { exists?: boolean; isFile?: boolean; isDirectory?: boolean } = {}): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message,
      prefix: '', // Remove the '?' prefix
      validate: async (input: string) => {
        if (!input) {
          return 'Path is required';
        }

        const fs = await import('fs-extra');

        if (options.exists && !(await fs.pathExists(input))) {
          return `Path does not exist: ${input}`;
        }

        if (options.isFile && !(await fs.stat(input)).isFile()) {
          return `Path is not a file: ${input}`;
        }

        if (options.isDirectory && !(await fs.stat(input)).isDirectory()) {
          return `Path is not a directory: ${input}`;
        }

        return true;
      },
    },
  ]);

  return value;
}

export function showMessage(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const prefix = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✓'),
    warning: chalk.yellow('⚠'),
    error: chalk.red('✗'),
  };

  process.stdout.write(`${prefix[type]} ${message}\n`);
}
