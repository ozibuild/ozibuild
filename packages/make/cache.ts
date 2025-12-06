import { existsSync, writeFileSync, readFileSync, mkdirSync, watch } from 'node:fs';
import { relative, basename, dirname, isAbsolute, join } from 'node:path';

import { CacheInfo, GenericCacheInfo, checksum } from '@ozibuild/core/caching';

import { prefixInfo } from '@ozibuild/core/log';
import { buildCmd } from './cmd';
import { SourceDirContext } from '@ozibuild/core/context';
import { notifyWatcher } from '@ozibuild/core/watching';

/** Computes {@link CacheInfo} for an output
 * 
 * @param out the target output file/directory that is being cached.
 * @param deps file or string dependencies, for which checksum is computed.
 * @param params string dependencies, ordered, which needs to stay invariant.
 * @returns cache info for the output.
 */
export function cacheInfo(ctx: SourceDirContext,
  out: string, deps: string[], params: string[]): CacheInfo {
  const info: GenericCacheInfo = {
    params,
    deps: []
  }
  for (const dep of deps) {
    const resolvedDep = ctx.resolvePath(dep);
    info.deps.push({ dep, checksum: existsSync(resolvedDep) ? checksum(resolvedDep) : dep });
  }
  const cacheDir = ctx.cachePath;
  mkdirSync(cacheDir, { recursive: true });
  const cachefile = join(cacheDir, basename(out) + '.cache');
  return new CacheInfo(cachefile, out, info);
}

function prepareLogFile(ctx: SourceDirContext, out: string) {
  const logDir = ctx.logPath;
  mkdirSync(logDir, { recursive: true });
  return join(logDir, basename(out) + '.log');
}

/** Runs a command that produces an output exactly once,
 * unless the command or dependencies change.
 * 
 * Command is run when any of the following conditions is met:
 * * `out` doesn't exist.
 * * Any `deps` have changed.
 * * `bin` or `args` have changed.
 * 
 * @param params.outfile Output to produce, representing a file.
 *    Absolute or relative to `cwd`.
 * @param params.deps Direct dependencies of output.
 *    A file dependency is checksumed, otherwise depdency is considered literally.
 * @param params.cwd Working directory for command.
 * @param params.bin Command binary.
 * @param params.args Verbatim command args. `out` and `deps` are independent from args,
 *    args need to be fully specified, i.e. duplicate `out` and `deps` as needed.
 * 
 * @returns a promise containing the output, after the output was generated.
 */
export async function cachedCmd(ctx: SourceDirContext,
  params: {
    outfile: string,
    stdoutfile: boolean,
    deps: string[],
    cwd: string,
    bin: string,
    args: string[]
  }): Promise<string> {
  const outfile = params.outfile;
  const deps = params.deps;
  notifyWatcher(outfile, deps);
  const cwd = params.cwd;
  const bin = params.bin;
  const args = params.args;
  const info: CacheInfo = cacheInfo(ctx, outfile, deps, [bin, ...args]);
  if (info.isCacheHit) {
    prefixInfo(relative(ctx.root.absolutePath, outfile), `cached.`);
    return Promise.resolve(outfile);
  }
  const logfile = prepareLogFile(ctx, outfile);
  await buildCmd(ctx, { outfile, stdoutfile: params.stdoutfile, bin, args, cwd, logfile });
  info.save();
  return outfile;
}
