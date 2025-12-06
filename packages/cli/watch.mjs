import { existsSync, watch } from 'node:fs';
import { stdin } from 'node:process';

import { resolveScript } from './make.mjs';
import { setWatcher, resetWatcher } from '@ozibuild/core/watching.js';


/** Tracks files during builds, watches changes on files and runs scheduled builds after observed changes */
class CliWatcher {
  trackedDeps = new Set();
  scheduledBuild;
  lastChange = undefined;
  lastBuild = undefined;
  build;
  target;

  constructor(target, buildMethod) {
    this.build = buildMethod;
    this.target = target;
  }

  track(target, deps) {
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
        if (!setWatcher(this)) {
          console.info(`${this.target}: watch busy, rescheduling...`);
          this.scheduleBuild();
          return;
        }
      }
      try {
        console.info(`(Re)building ${this.target}...`);
        await this.build();
        console.info(`${this.target}: success`);
      } catch (e) {
        console.warn(`${this.target}: failure`);
      }
      resetWatcher(this);
    }
    this.scheduledBuild = undefined;
  }
}


export async function ozibuildWatch(targets) {
  for (const target of targets) {
    const parts = target.split(':');
    if (parts.length <= 1) {
      console.error(`Target ${target} missing method to make`);
      continue;
    }
    const script = resolveScript(parts[0]);
    if (script.error) {
      console.error(`Invalid script: ${parts[0]} (${script.error})`);
      continue;
    }
    const module = await import(script.script);
    for (let i = 1; i < parts.length; ++i) {
      const watcher = new CliWatcher(`${parts[0]}:${parts[i]}`, module[parts[i]]);
      watcher.runBuild();
    }
  }
  stdin.resume();
}
