import { SpawnOptions, spawn } from 'node:child_process';
import { prefixInfo, prefixError, PrefixProgressLog } from '../util/log';
import { existsSync, writeFileSync } from 'node:fs';
import { SourceDirContext } from '../source/context';

declare global {
  var cmds: any
}
globalThis.cmds = globalThis.cmds || {}

/** Promisified version of {@link spawn}
 * 
 * @param bin command to run
 * @param args additional command arguments
 * @param options spawn options
 * 
 * @returns a promise of the stdout content from the command run, resolved upon command completion.
 */
export async function cmd(ctx: SourceDirContext,
  bin: string,
  args: string[],
  options: SpawnOptions): Promise<string> {
  const cl = `${bin} ${args.join(' ')}`;
  let p: Promise<string> = globalThis.cmds[cl];
  if (!p) {
    const prefixLogger = new PrefixProgressLog(bin);
    prefixLogger.log(args.join(" "));

    p = new Promise((resolve, reject) => {
      const cp = spawn(bin, args, { ...options, stdio: 'pipe' });
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
  return ctx.relativeOutputPath(outpath);
}

/** Runs a "build" command, i.e. a command that has an output. 
 * 
 * @param ctx Context, i.e. source directory. in which build commands executes.
 * @param params.out deprecate
 * @param params.outfile Indicates that the build command generates an output file or directory.
 * In this case a successful run of the command must produce the ouput.
 * @param params.outdir Indicates that the build command generates multiple files in an output directory.
 * @param params.label Indicates that the build generates a string as output.
 * @param params.bin Binary to execute
 * @param params.args Arguments to pass to binary.
 * @param params.cwd Working directory when executing the command.
 * 
 * @returns Resolved output file (params.outfile), when specified.
 *    Falls back to params.outdir, params.label or binary name.
 */
export async function buildCmd(ctx: SourceDirContext,
  params: {
    out?: { file?: string, text?: string },
    logfile?: string,
    outfile?: string,
    outdir?: string,
    label?: string,
    bin: string,
    args: string[],
    cwd?: string,
    env?: any
  }): Promise<string> {
  const bin = params.bin;
  const args = params.args;
  const cwd = params.cwd || ctx.absolutePath;
  const prefix = params.label
    || nullOrRelativePath(ctx, params.outfile)
    || nullOrRelativePath(ctx, params.outdir)
    || params.out?.text
    || nullOrRelativePath(ctx, params.out?.file)
    || params.bin;
  prefixInfo(prefix, `\x1b[35m${bin}\x1b[0m ${args.join(' ')}    \x1b[90m#cwd: ${cwd}\x1b[0m`);
  try {
    const stdout = await cmd(ctx, bin, args, { cwd, stdio: 'inherit', env: params.env });
    if (params.logfile) {
      writeFileSync(params.logfile, stdout);
    }
  } catch (error: any) {
    prefixError(prefix, `\x1b[35m${bin}\x1b[0m ${args.join(' ')}    \x1b[90m#cwd: ${cwd}\x1b[0m`);
    if (params.logfile) {
      writeFileSync(params.logfile, error.message);
    }
    console.error(error.message);
    throw error;
  }
  if (params.out?.file && !existsSync(params.out.file)) {
    throw Error(`Output ${params.out.file} was not produced by the commad [${bin} ${args.join(' ')}]`)
  }
  if (params.outfile && !existsSync(params.outfile)) {
    throw Error(`Output ${params.outfile} was not produced by the commad [${bin} ${args.join(' ')}]`)
  }
  if (params.outdir && !existsSync(params.outdir)) {
    throw Error(`Output ${params.outdir} was not produced by the commad [${bin} ${args.join(' ')}]`)
  }
  return params.outdir || params.outfile || params.label || params.out?.file || params.out?.text || bin;
}
