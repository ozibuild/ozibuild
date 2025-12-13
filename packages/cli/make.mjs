import { appendFileSync, existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";

const SCRIPT_NAMEs = ["ozibuild", "oziroot", "ozi-root", "ozi_root"];

const SCRIPT_EXTs = ['mjs', 'cjs', 'js']

export function resolveScript(scriptPath) {
  if (!scriptPath) {
    return { error: 'No scriptPath specified', script: null };
  }

  if (!existsSync(scriptPath)) {
    return { error: `${scriptPath} not found`, script: null };
  }

  if (lstatSync(scriptPath).isDirectory()) {
    for (let scriptName of SCRIPT_NAMEs) {
      for (let scriptExt of SCRIPT_EXTs) {
        const scriptPathWithName = join(scriptPath, scriptName + '.' + scriptExt);
        if (existsSync(scriptPathWithName)) {
          return { error: null, script: resolve(scriptPathWithName) };
        }
      }
    }
    return { error: `No script found for ${scriptPath}`, script: null };
  }

  return { error: null, script: resolve(scriptPath) };
}

export async function make(targets) {
  for (const target of targets) {
    const parts = target.split(':');
    if (parts.length <= 1) {
      console.error(`Target ${target} missing method to make`);
      continue;
    }
    const script = resolveScript(parts[0] || '.');
    if (script.error) {
      console.error(`Invalid script: ${parts[0]} (${script.error})`);
      continue;
    }
    const module = await import(script.script);
    for (let i = 1; i < parts.length; ++i) {
      module[parts[i]]();
    }
  }
}
