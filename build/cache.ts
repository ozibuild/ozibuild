import { existsSync, writeFileSync, readFileSync, mkdirSync, watch } from 'node:fs';
import { relative, basename, dirname, isAbsolute, join } from 'node:path';

import { checksum } from '../util/checksum';
import { prefixInfo } from '../util/log';
import { buildCmd } from './cmd';
import { SourceDirContext } from '../source/context';
import { notifyWatcher } from './watch';

/** Cache info json content. */
interface GenericCacheInfo {
  deps: {
    dep: string,
    checksum: string
  }[],
  params: string[]
}

/** CacheInfo */
export class CacheInfo {
  /** Initializes a cache info for an output file.
   * 
   * @param cacheInfoFile File containing previously cached information.
   * @param out Output file being generated.
   * @param info The content of the cached information for the current run. 
   */
  constructor(private cacheInfoFile: string,
    public out: string,
    private info: GenericCacheInfo) { }

  /**
   * Indicates whether the cache information indicates the output is up-to-date.
   */
  get isCacheHit(): boolean {
    if (!existsSync(this.out) || !existsSync(this.cacheInfoFile)) {
      return false;
    }
    const prevInfo = JSON.parse(readFileSync(this.cacheInfoFile, { encoding: 'utf8' }));
    if (prevInfo.params?.length !== this.info.params.length ||
      prevInfo.deps?.length !== this.info.deps?.length) {
      return false;
    }
    for (let i = 0; i < this.info.params.length; ++i) {
      if (this.info.params[i] !== prevInfo.params[i]) {
        return false;
      }
    }
    const m = new Map();
    for (const dep of this.info.deps) {
      m.set(dep.dep, dep.checksum);
    }
    for (const dep of prevInfo.deps) {
      if (m.get(dep.dep) !== dep.checksum) {
        return false;
      }
    }
    return true;
  }

  /** Updates the persisted cached information with the latest info. */
  save() {
    mkdirSync(dirname(this.cacheInfoFile), { recursive: true });
    writeFileSync(this.cacheInfoFile, JSON.stringify(this.info, null, "  "));
  }
}

function makeRelativeOut(ctx: SourceDirContext, out: string) {
  const outputPath = relative(ctx.root.outputPath(false), dirname(out));
  if (!outputPath.startsWith('..')) {
    return outputPath;
  }
  return ctx.relativeOutputPath(dirname(out));
}

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
  const cacheDir = isAbsolute(out)
    ? makeRelativeOut(ctx, out)
    : ctx.sourcePath;
  const cachefile = join(
    ctx.root.outputPath(true), '.cache', cacheDir,
    basename(out) + '.cache');
  return new CacheInfo(cachefile, out, info);
}

function prepareLogFile(ctx: SourceDirContext, out: string) {
  const relativeLogDir = isAbsolute(out)
    ? makeRelativeOut(ctx, out)
    : ctx.sourcePath;
  const logDir = join(ctx.root.outputPath(true), '.log', relativeLogDir);
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
    deps: string[],
    cwd: string,
    bin: string,
    args: string[]
  }): Promise<string> {
  const out = params.outfile;
  const deps = params.deps;
  notifyWatcher(out, deps);
  const cwd = params.cwd;
  const bin = params.bin;
  const args = params.args;
  const info: CacheInfo = cacheInfo(ctx, out, deps, [bin, ...args]);
  if (info.isCacheHit) {
    prefixInfo(ctx.relativeOutputPath(out), `cached.`);
    return Promise.resolve(out);
  }
  const logfile = prepareLogFile(ctx, out);
  await buildCmd(ctx, { out: { file: out }, bin, args, cwd, logfile });
  info.save();
  return out;
}
