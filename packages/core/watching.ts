export interface Watcher {
  track(target: string, deps: string[]): void;
}

declare global {
  var watcher : Watcher | undefined;
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
export function setWatcher(watcher: Watcher): boolean {
  if (globalThis.watcher == null) {
    globalThis.watcher = watcher;
    return true;
  }
  return false;
}

/** Stops tracking dependencies through the given watcher.
 * 
 * @param watcher for which ozibuild should stop tracking
 * @returns {@code false} watcher could not be stopped.
 */
export function resetWatcher(watcher: Watcher): boolean {
  if (globalThis.watcher == watcher) {
    globalThis.watcher = undefined;
    return true;
  }
  return false;
}


/** During a build, tracks dependencies for the watcher. */
export function notifyWatcher(target: string, deps: string[]) {
  if (globalThis.watcher != null) {
    globalThis.watcher.track(target, deps);
  }
}
