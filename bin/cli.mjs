import { existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";

const SCRIPT_PATHS = [
  "ozibuild.mjs", "ozibuild.cjs", "ozibuild.js",
  "scripts/ozibuild.mjs", "scripts/ozibuild.cjs", "scripts/ozibuild.js"
];

export function resolveScript(scriptPath) {
  if (!scriptPath) {
    return { error: 'No scriptPath specified', script: null };
  }

  if (!existsSync(scriptPath)) {
    return { error: `${scriptPath} not found`, script: null };
  }

  if (lstatSync(scriptPath).isDirectory) {
    for (let jsPath of SCRIPT_PATHS) {
      if (existsSync(join(scriptPath, jsPath))) {
        return { error: null, script: resolve(join(scriptPath, jsPath)) };
      }
    }
    return { error: `No script found for ${scriptPath}`, script: null };
  }

  return { error: null, script: resolve(scriptPath) };
}

export async function run(args) {
  const scriptPath = resolveScript(args[0]);
  if (!scriptPath.script) {
    console.error(scriptPath.error);
    process.exit(-1);
  }

  const methods = args.slice(1);

  const script = await import(scriptPath.script);
  for (let method of methods) {
    if (method === '.') {
      for (let m in script) {
        script[m]();
      }
    } else {
      script[method]();
    }
  }
}
