import { logger } from '@utils/logger';
import { type ExecaReturnValue, execa, type Options } from 'execa';

export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode?: number;
  error?: Error;
}

export interface CommandResult extends ShellResult {
  command: string;
  args: string[];
}

export interface ShellOptions extends Options {
  silent?: boolean;
  throwOnError?: boolean;
  timeout?: number;
}

export async function exec(command: string, args: string[] = [], options: Options = {}): Promise<ShellResult> {
  try {
    const result = await execa(command, args, {
      ...options,
      reject: false,
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export async function run(command: string, options: ShellOptions = {}): Promise<CommandResult> {
  const { silent = false, throwOnError = false, ...execaOptions } = options;

  if (!silent) {
    logger.command(command);
  }

  if (!command || command.trim() === '') {
    throw new Error('Command cannot be empty');
  }

  try {
    const result: ExecaReturnValue = await execa(command, {
      ...execaOptions,
      reject: false,
      shell: true,
    });

    const shellResult: CommandResult = {
      success: result.exitCode === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode || 0,
      command: command,
      args: [],
    };

    if (!shellResult.success && throwOnError) {
      const error = new Error(`Command failed with exit code ${shellResult.exitCode}: ${command}`);
      throw error;
    }

    return shellResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (throwOnError) {
      throw error;
    }

    return {
      success: false,
      stdout: '',
      stderr: errorMessage,
      error: error instanceof Error ? error : new Error(errorMessage),
      command: command,
      args: [],
    };
  }
}

export async function which(command: string): Promise<string | null> {
  try {
    const result = await exec('which', [command]);
    return result.success ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

export async function commandExists(command: string): Promise<boolean> {
  return which(command).then((path) => path !== null);
}

export async function execInteractive(command: string, args: string[] = [], options: Options = {}): Promise<number> {
  try {
    logger.debug(`Executing interactive: ${command} ${args.join(' ')}`);

    const result = await execa(command, args, {
      ...options,
      stdio: 'inherit',
      reject: false,
    });

    return result.exitCode || 0;
  } catch (error) {
    logger.error(`Interactive command failed: ${command}`, error);
    throw error;
  }
}

export async function execAsync(command: string, args: string[] = [], options: Options = {}): Promise<ShellResult> {
  return exec(command, args, options);
}
