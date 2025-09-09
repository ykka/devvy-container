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
      prefix: '', // Disable inquirer's default green "?" prefix for cleaner output
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
      prefix: '', // Disable inquirer's default green "?" prefix for cleaner output
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
      prefix: '', // Disable inquirer's default green "?" prefix for cleaner output
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
      prefix: '', // Disable inquirer's default green "?" prefix for cleaner output
    },
  ]);

  return selected;
}

export async function path(message: string, options: { exists?: boolean; isFile?: boolean; isDirectory?: boolean } = {}): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message,
      prefix: '', // Disable inquirer's default green "?" prefix for cleaner output
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
