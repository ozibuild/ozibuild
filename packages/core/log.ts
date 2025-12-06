import { isAbsolute, relative } from "node:path";
import { CacheInfo } from "./caching";

/** Encapsulates options for logging. */
export interface LogOptions {
  /** Root directory for source tree specified as absolute path. */
  sourceRootPath?: string;
  /** Root directory for output tree specified as absolute path. */
  outputRootPath?: string;
  /** Current working directory for the action. */
  cwd?: string;
}

function outputPrefix(output: string, options?: LogOptions): string {
  if (!options) {
    return output;
  }
  let prefix = output;
  if (isAbsolute(output) && options.outputRootPath) {
    prefix = relative(options.outputRootPath, output);
    if (prefix.startsWith('../') && options.sourceRootPath) {
      prefix = relative(options.sourceRootPath, output);
    }
  }
  return prefix;
}

/** Logs an action that produces an output.
 * 
 * @param output Output path. If it is relative it is assumed relative to the outputRoot.
 * @param message Message to log.
 * @param options Log options.
 */
export function logOutputAction(output: string, message: string, options?: LogOptions) {
  if (process.stdout.clearLine) {
    process.stdout.clearLine(0);
  }
  const cwdInfo = options?.cwd ? `    \x1b[90m#cwd: ${options.cwd}\x1b[0m` : '';
  console.info(`\x1b[33m${outputPrefix(output, options)}:\x1b[0m ${message} ${cwdInfo}`);
}

/** Logs the fact that the output is cached.
 * 
 * @param output  Output path. If it is relative it is assumed relative to the outputRoot.
 * @param options Log options.
 * @param cacheInfo Information based on which it was determined the output was cached.
 */
export function logOutputCached(output: string, options?: LogOptions, cacheInfo?: CacheInfo) {
  if (process.stdout.clearLine) {
    process.stdout.clearLine(0);
  }
  console.info(`\x1b[33m${outputPrefix(output, options)}: \x1b[90mcached.\x1b[0m`);
}

/** Logs an error related to the output.
 * 
 * @param output Output path. If it is relative it is assumed relative to the outputRoot.
 * @param message Error message.
 * @param options Log options.
 */
export function logOutputError(output: string, message: string, options?: LogOptions) {
  if (process.stdout.clearLine) {
    process.stdout.clearLine(0);
  }
  console.info(`\x1b[31m${outputPrefix(output, options)}:\x1b[0m ${message}`);
}

/** Logging with colored prefix for info */
export function prefixInfo(prefix: string, message: string) {
  if (process.stdout.clearLine) {
    process.stdout.clearLine(0);
  }
  console.info(`\x1b[33m${prefix}:\x1b[0m ${message}`);
}

/** Logging with colored prefix for error. */
export function prefixError(prefix: string, message: string) {
  if (process.stdout.clearLine) {
    process.stdout.clearLine(0);
  }
  console.info(`\x1b[31m${prefix}:\x1b[0m ${message}`);
}

const loggers: PrefixProgressLog[] = [];
let scheduledLog: NodeJS.Timeout | undefined = undefined;

function scheduleProgressLog(logger: PrefixProgressLog) {
  loggers.push(logger);
  if (loggers.length > 1 && scheduledLog == null) {
    scheduledLog = setInterval(() => {
      for (let logger = loggers.shift(); logger; logger = loggers.shift()) {
        if (logger.next()) {
          loggers.push(logger);
          break;
        }
      }
      if (loggers.length == 0) {
        clearInterval(scheduledLog);
        scheduledLog = undefined;
      }
    }, 200);
  }
}

export class PrefixProgressLog {
  constructor(private readonly prefix: string) { }

  logQueue: string[] = [];


  finished = false;

  log(message: string) {
    if (!process.stdout.clearLine || !process.stdout.cursorTo) {
      return;
    }
    scheduleProgressLog(this);
    this.logQueue.push(...message.split('\n')
      .filter(line => line !== ''));
  }

  next() {
    if (this.finished) {
      return false;
    }
    const logLine = this.logQueue.shift();
    if (!logLine) {
      return false;
    }
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`\x1b[33m${this.prefix}:\x1b[0m ${logLine.substring(0, 100)}\r`);
    return true;
  }

  finish() {
    this.finished = true;
  }
}
