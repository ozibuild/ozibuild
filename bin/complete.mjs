import { appendFileSync, existsSync, lstatSync, opendirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { resolveScript } from "./cli.mjs";
import { stdout } from "node:process";

function subdirs(dirPath) {
  const dirnames = [];
  if (dirPath && (!existsSync(dirPath) || !lstatSync(dirPath).isDirectory())) {
    return dirnames;
  }
  const resolvedPath = dirPath ? resolve(dirPath) : process.cwd();
  try {
    const dir = opendirSync(resolvedPath);
    for (let subdir = dir.readSync(); subdir; subdir = dir.readSync()) {
      if (subdir.isDirectory()) {
        dirnames.push(subdir.name + '/');
      }
    }
    dir.close();
  } catch (error) {
    // Ignore silently
  }
  return dirnames
}

async function scriptMethods(dir) {
  const methods = [];
  const script = resolveScript(dir);
  if (script.script && !script.error) {
    const m = await import(script.script);
    for (const exp in m) {
      if (typeof m[exp] === 'function') {
        methods.push(exp);
      }
    }
  }
  return methods;
}

export async function complete(args) {
  const word = args[0];
  const dir = args[2];
  appendFileSync('/tmp/ozibuild.log', `oricomplete args: ${word} ${dir} [${args.join(',')}]\n`);

  if (word === dir) {
    const dirnames = [];
    if (!word) {
      dirnames.push(...subdirs());
    } else if (word.endsWith('/')) {
      dirnames.push(...subdirs(word));
    } else {
      const parent = dirname(word);
      const prefix = basename(word);
      dirnames.push(...subdirs(parent)
        .filter(subdir => subdir.startsWith(prefix))
        .map(subdir => join(parent, subdir)));
      dirnames.push(...subdirs(word));
    }
    stdout.write(dirnames.join(' '));
  } else if (dir) {
    stdout.write((await scriptMethods(dir))
      .filter(method => !word || method.startsWith(word))
      .join(' '));
  }
}
