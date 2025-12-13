import { existsSync, mkdirSync } from 'node:fs';
import { relative, basename, join } from 'node:path';

import { CacheInfo, GenericCacheInfo, checksum } from '@ozibuild/core/caching';

import { prefixInfo } from '@ozibuild/core/log';
import { build } from './cmd';
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

/** Runs a command that produces an output exactly once,
 * unless the command or dependencies change.
 * 
 * Command is run when any of the following conditions is met:
 * - `out.file` doesn't exist.
 * - Any `deps` have changed.
 * - `cmd` have changed.
 * 
 * @param out.file Output to produce, representing a file.
 * @param out.stdout Indicates the output is produced from the stdout of the command.
 * @param params.deps Direct dependencies of output.
 *    A file dependency is checksumed, otherwise depdency is considered literally.
 * @param params.command Command binary and args.
 *    `out` and `deps` are independent from args,
 *    args need to be fully specified, i.e. duplicate `out` and `deps` as needed.
 * @param params.cwd Working directory for command.
 * 
 * @returns a promise containing the output, after the output was generated.
 */
export async function cachedCmd(ctx: SourceDirContext,
  out: {
    file?: string,
    stdout?: boolean,
  },
  params: {
    deps: string[],
    cmd: string[],
    cwd?: string,
  }): Promise<string> {
  const outfile = ctx.outputFile(out.file!);
  const deps = params.deps;
  notifyWatcher(outfile, deps);
  const cwd = params.cwd;
  const cmd = params.cmd;
  const info: CacheInfo = cacheInfo(ctx, outfile, deps, cmd);
  if (info.isCacheHit) {
    prefixInfo(relative(ctx.root.absolutePath, outfile), `cached.`);
    return Promise.resolve(outfile);
  }
  const result = await build(ctx, out, { cmd, cwd });
  info.save();
  return result;
}
