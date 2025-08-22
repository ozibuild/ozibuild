import { existsSync, watch } from 'node:fs';

import { prefixError, prefixInfo } from '../util/log';
import { SourceDirContext } from '../source/context';


/** Tracks files during builds, watches changes on files and runs scheduled builds after observed changes */
class Watcher {
  static collector?: Watcher = undefined;

  trackedDeps = new Set<string>();
  scheduledBuild?: any;
  lastChange?: number = undefined;
  lastBuild?: number = undefined;
  constructor(private readonly build: () => Promise<any>) { }
  track(target: string, deps: string[]) {
    deps.forEach(dep => {
      if (!existsSync(dep)) {
        return;
      }
      if (this.trackedDeps.has(dep)) {
        return;
      }
      this.trackedDeps.add(dep);
      watch(dep, () => {
        this.scheduleBuild();
      });
    });
  }
  scheduleBuild() {
    this.lastChange = new Date().getTime();
    if (this.scheduledBuild == null) {
      this.scheduledBuild = setTimeout(() => this.runBuild(), 1000);
    }
  }
  async runBuild() {
    while ((this.lastBuild == null)
      || (this.lastChange != null && this.lastChange > this.lastBuild)) {
      this.lastBuild = new Date().getTime();
      if (this.trackedDeps.size === 0) {
        Watcher.collector = this;
      }
      try {
        await this.build();
      } catch (e) {
        prefixError("watch", `Build failed: ${e}`);
      }
      if (Watcher.collector == this) {
        Watcher.collector = undefined;
      }
    }
    this.scheduledBuild = undefined;
  }
}


/** Tracks the dependencies during the given build method.
 * Whenever depdenencies change, the build is invoked again.
 * Build invocations are serialized, and it is guaranteed to
 * have a build invocation started after the last observed changed.
 * 
 * @param build The method to build. Invoked at least once.
 * @return a promise that is never resolved, 
 * which can be used to wait indefinitely.
 */
export async function watchDeps(ctx: SourceDirContext,
  build: () => Promise<any>, options: {}): Promise<any> {
  const watcher = new Watcher(build);
  await watcher.runBuild();
  prefixInfo("watch", "Waiting for deps changes...");
  return new Promise(function () { })
}

/** During a build, tracks dependencies for the watcher. */
export function notifyWatcher(target: string, deps: string[]) {
  if (Watcher.collector != null) {
    Watcher.collector.track(target, deps);
  }
}
