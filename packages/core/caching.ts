import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

/** Cache info json content. */
export interface GenericCacheInfo {
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

export function checksum(filePath: string) {
  try {
    const content = readFileSync(filePath);
    return createHash('md5').update(content).digest('hex');
  } catch (e) {
    return 'error';
  }
}
