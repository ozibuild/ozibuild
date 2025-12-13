import { SpawnOptions, spawn } from 'node:child_process';
import { prefixInfo, prefixError, PrefixProgressLog } from '../core/log';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, relative, join, dirname } from 'node:path';
import { SourceDirContext } from '../core/context';
import { createHash } from 'node:crypto';

declare global {
  var cmds: any
}
globalThis.cmds = globalThis.cmds || {}

/** Promisified version of {@link spawn}
 * 
 * @param bin command to run
 * @param args additional command arguments
 * @param options spawn options
 * @param stdin content of the stdin of the command to run, if any.
 * 
 * @returns a promise of the stdout content from the command run, resolved upon command completion.
 */
async function cmd(bin: string, args: string[], options: SpawnOptions, stdin?: string): Promise<string> {
  const cl = `${bin} ${(args || []).join(' ')}`;
  let p: Promise<string> = globalThis.cmds[cl];
  if (!p) {
    const prefixLogger = new PrefixProgressLog(bin);
    prefixLogger.log((args || []).join(" "));

    p = new Promise((resolve, reject) => {
      const cp = spawn(bin, args, { ...options, stdio: 'pipe' });
      if (stdin) {
        cp.stdin.write(stdin);
        cp.stdin.end();
      }
      const stdout: string[] = [];

      cp.on('error', (e) => {
        prefixLogger.finish();
        reject(e);
        delete globalThis.cmds[cl];
      });

      cp.stdout.on('data', (data) => {
        const dataText = data?.toString() || '';
        stdout.push(dataText);
        prefixLogger.log(dataText);
      });

      cp.stderr.on('data', (data) => {
        const dataText = data?.toString() || '';
        stdout.push(dataText);
        prefixLogger.log(dataText);
      });

      cp.on('close', (code, signal) => {
        prefixLogger.finish();
        if (code !== 0 || signal != null) {
          reject(Error(`${cp.spawnfile} exited with error ${code}${signal}\n\n\n\n${stdout.join('')}`));
          delete globalThis.cmds[cl];
        }
        resolve(stdout.join(''));
        delete globalThis.cmds[cl];
      });
    });
    globalThis.cmds[cl] = p;
  }
  return p;
}

function nullOrRelativePath(ctx: SourceDirContext, outpath?: string): string | undefined {
  if (!outpath) {
    return outpath;
  }
  return relative(ctx.root.absolutePath, outpath);
}

function inferLogFilename(out: { file?: string, dir?: string }, cmd: string[]) {
  const cmd_checksum = createHash('md5').update(cmd.join(' ')).digest('hex');
  if (out.file) {
    return `${basename(out.file)}.${cmd_checksum}.log`;
  }
  if (out.dir) {
    return `${basename(out.dir)}.${cmd_checksum}.log`;
  }
  return `${basename(cmd[0])}.${cmd_checksum}.log`;
}

/** Executes a "build" command, i.e. a command that has an output, in context of a source directory.
 * 
 * @param ctx Context, i.e. source directory. in which build commands executes.
 * @param out.file Indicates that the build command generates an output file.
 * In this case a successful run of the command must produce the ouput.
 * @param out.stdout Indicates to produce the output from stdout.
 * If out.file is specified, the output from stdout is written into out.file, otherwise it is returned as text.
 * @param out.dir Indicates that the build command generates multiple files in an output directory.
 * @param out.stdout Indicates that the build generates a string as output.
 * @param out.label Output is the specified text.
 * @param params.cmd Binary to execute and arguments to pass to binary.
 * @param params.cwd Working directory when executing the command. Defaults to ctx
 * @param params.env Additional env variables.
 * 
 * @returns Resolved one of the following values:
 *    * Resolved out.file, when specified 
 *    * Resolved out.dir, when specified
 *    * Program stdout, when out.stdout is true
 *    * out.label, when specified
 */
export async function build(ctx: SourceDirContext,
  out: {
    file?: string,
    dir?: string,
    stdout?: boolean,
    label?: string
  },
  params: {
    cmd: string[],
    input?: {
      text?: string,
      file?: string
    },
    cwd?: string,
    env?: any
  }): Promise<string> {
  const bin = params.cmd[0];
  const args = params.cmd.slice(1);
  const cwd = params.cwd || ctx.absolutePath;
  const prefix = nullOrRelativePath(ctx, out.file)
    || nullOrRelativePath(ctx, out.dir)
    || out.label
    || bin;
  prefixInfo(prefix, `\x1b[35m${bin}\x1b[0m ${args.join(' ')}    \x1b[90m#cwd: ${cwd}\x1b[0m`);
  const logfile = join(ctx.logPath, inferLogFilename(out, params.cmd));
  mkdirSync(dirname(logfile), { recursive: true });

  let stdin = params.input?.text;
  let stdout_text = undefined;
  try {
    const stdout = await cmd(bin, args, { cwd, env: params.env }, stdin);
    if (out.stdout) {
      if (out.file) {
        writeFileSync(ctx.outputFile(out.file), stdout);
      } else {
        stdout_text = stdout;
      }
    } else {
      writeFileSync(logfile, stdout);
    }
  } catch (error: any) {
    prefixError(prefix, `\x1b[35m${bin}\x1b[0m ${args.join(' ')}    \x1b[90m#cwd: ${cwd}\x1b[0m`);
    writeFileSync(logfile, error.message);
    console.error(error.message);
    throw error;
  }
  if (out.file && !existsSync(out.file)) {
    throw Error(`Output ${out.file} was not produced by the commad [${bin} ${args.join(' ')}]`)
  }
  if (out.dir && !existsSync(out.dir)) {
    throw Error(`Output ${out.dir} was not produced by the commad [${bin} ${args.join(' ')}]`)
  }
  return out.file || out.dir || stdout_text || out.label || bin;
}
