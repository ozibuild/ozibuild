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
    if (prefix.startsWith("../") && options.sourceRootPath) {
      prefix = relative(options.sourceRootPath, output);
    }
  }
  return prefix;
}

let lastLogProgress = false;
let lastLogProgressLength = 0;

export function log(text: string, progress?: boolean) {
  if (lastLogProgress && process.stdout.cursorTo && process.stdout.clearLine) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    if (lastLogProgressLength > text.length) {
      process.stdout.write(" ".repeat(lastLogProgressLength));
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }
  lastLogProgress = progress ?? false;
  lastLogProgressLength = progress ? text.length : 0;
  if (progress) {
    process.stdout.write(text + "\r");
  } else {
    console.info(text);
  }
}

/** Logs an action that produces an output.
 *
 * @param output Output path. If it is relative it is assumed relative to the outputRoot.
 * @param message Message to log.
 * @param options Log options.
 */
export function logOutputAction(
  output: string,
  message: string,
  options?: LogOptions,
) {
  const cwdInfo = options?.cwd ? `    \x1b[90m#cwd: ${options.cwd}\x1b[0m` : "";
  log(`\x1b[33m${outputPrefix(output, options)}:\x1b[0m ${message} ${cwdInfo}`);
}

/** Logs the fact that the output is cached.
 *
 * @param output  Output path. If it is relative it is assumed relative to the outputRoot.
 * @param options Log options.
 * @param cacheInfo Information based on which it was determined the output was cached.
 */
export function logOutputCached(
  output: string,
  options?: LogOptions,
  cacheInfo?: CacheInfo,
) {
  log(`\x1b[33m${outputPrefix(output, options)}: \x1b[90mcached.\x1b[0m`);
}

/** Logs an error related to the output.
 *
 * @param output Output path. If it is relative it is assumed relative to the outputRoot.
 * @param message Error message.
 * @param options Log options.
 */
export function logOutputError(
  output: string,
  message: string,
  options?: LogOptions,
) {
  log(`\x1b[31m${outputPrefix(output, options)}:\x1b[0m ${message}`);
}

/** Logging with colored prefix for info */
export function prefixInfo(prefix: string, message: string) {
  log(`\x1b[33m${prefix}:\x1b[0m ${message}`);
}

/** Logging with colored prefix for error. */
export function prefixError(prefix: string, message: string) {
  log(`\x1b[31m${prefix}:\x1b[0m ${message}`);
}

const loggers: PrefixProgressLog[] = [];
let scheduledLog: NodeJS.Timeout | undefined = undefined;

function scheduleProgressLog(logger: PrefixProgressLog) {
  loggers.push(logger);
  if (loggers.length > 1 && scheduledLog == null) {
    scheduledLog = setInterval(() => {
      for (let logger = loggers.shift(); logger; logger = loggers.shift()) {
        if (logger.writeNext()) {
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
  constructor(private readonly prefix: string) {}

  logQueue: string[] = [];

  finished = false;

  /** Logs a message by enqueing it into the progress queue. */
  log(message: string) {
    if (!process.stdout.clearLine || !process.stdout.cursorTo) {
      return;
    }
    scheduleProgressLog(this);
    this.logQueue.push(...message.split("\n").filter((line) => line !== ""));
  }

  /** Writes the next line as the progress input. */
  writeNext() {
    if (this.finished) {
      return false;
    }
    const logLine = this.logQueue.shift();
    if (!logLine) {
      return false;
    }
    log(`\x1b[33m${this.prefix}:\x1b[0m ${logLine.substring(0, 100)}`, true);
    return true;
  }

  finish() {
    this.finished = true;
  }
}
