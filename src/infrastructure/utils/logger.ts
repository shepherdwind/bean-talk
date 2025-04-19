import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface ILogger {
  setLogLevel(level: LogLevel): void;
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: any): void;
}

export class Logger implements ILogger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public debug(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.logToOutput('debug', chalk.gray(`[DEBUG] ${this.getTimestamp()} - ${message}`), ...args);
    }
  }

  public info(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.logToOutput('info', chalk.blue(`[INFO] ${this.getTimestamp()} - ${message}`), ...args);
    }
  }

  public warn(message: string, ...args: any[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.logToOutput('warn', chalk.yellow(`[WARN] ${this.getTimestamp()} - ${message}`), ...args);
    }
  }

  public error(message: string, error?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.logToOutput('error', chalk.red(`[ERROR] ${this.getTimestamp()} - ${message}`));
      if (error) {
        if (error instanceof Error) {
          this.logToOutput('error', chalk.red(`Stack: ${error.stack}`));
        } else {
          this.logToOutput('error', chalk.red('Error details:'), error);
        }
      }
    }
  }

  private logToOutput(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    // This is a centralized method for output that can be customized further
    // For now, we'll use process.stdout/stderr to avoid console methods
    const output = level === 'error' ? process.stderr : process.stdout;
    
    if (args.length > 0) {
      output.write(message + ' ');
      args.forEach(arg => {
        if (typeof arg === 'object') {
          output.write(JSON.stringify(arg, null, 2) + ' ');
        } else {
          output.write(arg + ' ');
        }
      });
      output.write('\n');
    } else {
      output.write(message + '\n');
    }
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }
}

// Singleton instance for direct import
export const logger = Logger.getInstance();

// Factory function for dependency injection
export function createLogger(level?: LogLevel): ILogger {
  const loggerInstance = Logger.getInstance();
  if (level !== undefined) {
    loggerInstance.setLogLevel(level);
  }
  return loggerInstance;
}

// Initialize log level from environment variable if available
if (process.env.LOG_LEVEL) {
  const envLogLevel = process.env.LOG_LEVEL.toUpperCase();
  if (envLogLevel in LogLevel) {
    logger.setLogLevel(LogLevel[envLogLevel as keyof typeof LogLevel]);
    console.log(`Logger initialized with level: ${envLogLevel}`);
  } else {
    console.warn(`Invalid LOG_LEVEL: ${envLogLevel}. Using default level.`);
  }
} else {
  console.log('LOG_LEVEL not set. Using default level.');
}