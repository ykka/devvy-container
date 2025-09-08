import { ConfigService } from '@services/config.service';
import chalk from 'chalk';
import * as winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const customFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  let output = `${ts as string} [${level}]: ${message as string}`;

  if (Object.keys(metadata).length > 0) {
    output += ` ${JSON.stringify(metadata)}`;
  }

  return output;
});

const consoleFormat = printf(({ level, message }) => {
  const levelUpperCase = level.toUpperCase();

  // For INFO level, just return the message without prefix
  if (levelUpperCase === 'INFO') {
    return message as string;
  }

  let coloredLevel: string;
  switch (levelUpperCase) {
    case 'ERROR': {
      coloredLevel = chalk.red('✗');
      break;
    }
    case 'WARN': {
      coloredLevel = chalk.yellow('⚠');
      break;
    }
    case 'DEBUG': {
      coloredLevel = chalk.gray('○');
      break;
    }
    default: {
      coloredLevel = levelUpperCase;
    }
  }

  return `${coloredLevel} ${message as string}`;
});

class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    const config = ConfigService.getInstance();
    const loggingConfig = config.getLoggingConfig();

    this.logger = winston.createLogger({
      level: loggingConfig.level,
      format: combine(timestamp(), customFormat),
      transports: [
        new winston.transports.Console({
          format: combine(colorize(), consoleFormat),
        }),
      ],
    });

    if (loggingConfig.file) {
      this.logger.add(
        new winston.transports.File({
          filename: loggingConfig.file,
          format: combine(timestamp(), customFormat),
        }),
      );
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, metadata?: Record<string, unknown>): void {
    // For info messages, write directly to stdout to avoid prefix
    process.stdout.write(`${message}\n`);
    // Still log to file if configured
    if (metadata) {
      this.logger.debug(`Info with metadata: ${message}`, metadata);
    }
  }

  public error(message: string, error?: Error | unknown): void {
    process.stdout.write(`${chalk.red('✗')} ${message}\n`);
    if (error instanceof Error) {
      this.logger.debug(`Error details: ${message}`, {
        error: error.message,
        stack: error.stack,
      });
    } else if (error) {
      this.logger.debug(`Error details: ${message}`, { error });
    }
  }

  public warn(message: string, metadata?: Record<string, unknown>): void {
    process.stdout.write(`${chalk.yellow('⚠')} ${message}\n`);
    if (metadata) {
      this.logger.debug(`Warning with metadata: ${message}`, metadata);
    }
  }

  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.logger.debug(message, metadata);
  }

  public success(message: string): void {
    process.stdout.write(`${chalk.green('✓')} ${message}\n`);
  }

  public step(message: string): void {
    process.stdout.write(`  ${chalk.cyan('•')} ${message}\n`);
  }

  public command(cmd: string): void {
    process.stdout.write(`${chalk.gray('$')} ${chalk.white(cmd)}\n`);
  }

  public box(message: string): void {
    const border = '─'.repeat(message.length + 2);
    process.stdout.write(`${chalk.blue(`┌${border}┐`)}\n`);
    process.stdout.write(`${chalk.blue('│')} ${message} ${chalk.blue('│')}\n`);
    process.stdout.write(`${chalk.blue(`└${border}┘`)}\n`);
  }
}

let _logger: Logger | null = null;

export const logger = {
  info: (message: string, metadata?: Record<string, unknown>) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.info(message, metadata);
  },
  error: (message: string, error?: Error | unknown) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.error(message, error);
  },
  warn: (message: string, metadata?: Record<string, unknown>) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.warn(message, metadata);
  },
  debug: (message: string, metadata?: Record<string, unknown>) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.debug(message, metadata);
  },
  success: (message: string) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.success(message);
  },
  step: (message: string) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.step(message);
  },
  command: (cmd: string) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.command(cmd);
  },
  box: (message: string) => {
    if (!_logger) _logger = Logger.getInstance();
    _logger.box(message);
  },
};
