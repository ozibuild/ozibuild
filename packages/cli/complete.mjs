import { existsSync, lstatSync, opendirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { stdout } from "node:process";
import { getExportedFunctions } from "./exported_functions.mjs";
import { resolveScript } from "./make.mjs";

function listDirs(dirPath) {
  const dirnames = [];
  if (dirPath && (!existsSync(dirPath) || !lstatSync(dirPath).isDirectory())) {
    return dirnames;
  }
  const resolvedPath = dirPath ? resolve(dirPath) : process.cwd();
  try {
    const dir = opendirSync(resolvedPath);
    for (let subdir = dir.readSync(); subdir; subdir = dir.readSync()) {
      if (subdir.name.startsWith('.') || subdir.name === 'node_modules') {
        continue;
      }
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

function hasJavascriptExt(filename) {
  return filename.endsWith('.js')
    || filename.endsWith('.mjs')
    || filename.endsWith('.cjs');
}

function listScripts(dirPath) {
  const scripts = [];
  if (dirPath && (!existsSync(dirPath) || !lstatSync(dirPath).isDirectory())) {
    return scripts;
  }
  const resolvedPath = dirPath ? resolve(dirPath) : process.cwd();
  try {
    const dir = opendirSync(resolvedPath);
    for (let file = dir.readSync(); file; file = dir.readSync()) {
      if (file.isFile() && hasJavascriptExt(file.name)) {
        scripts.push(file.name);
      }
    }
    dir.close();
  } catch (error) {
    // Ignore silently
  }
  return scripts;
}

function completeDirs(target) {
  if (target.endsWith('/')) {
    return listDirs(target);
  }
  const targetName = basename(target);
  if (targetName.indexOf(':') >= 0) {
    // No completion: already expanding methods
    return [];
  }
  if (existsSync(target) && lstatSync(target).isFile()) {
    // No completion: already a (script) file
    return [];
  }
  const dirs = listDirs(dirname(target));
  return dirs.filter(dir => dir.startsWith(targetName));
}

function completeScripts(target) {
  if (target.endsWith('/') || existsSync(target) && lstatSync(target).isDirectory()) {
    return listScripts(target);
  }
  const targetName = basename(target);
  if (targetName.includes(':')) {
    // No completion: already expanding methods
    return [];
  }
  if (existsSync(target) && lstatSync(target).isFile()) {
    // No completion: already a (script) file
    return [];
  }
  const scripts = listScripts(dirname(target));
  return scripts.filter(script => script.startsWith(targetName));
}

function resolveTargetScript(target) {
  if (target.includes(':')) {
    target = target.split(':', 2)[0];
  }
  if (target === '') {
    target = '.';
  }
  return resolveScript(target).script;
}

function listScriptMethods(script) {
  return getExportedFunctions(script);
}

function completeFunctions(word) {
  const lastColon = word.lastIndexOf(':');
  const target = (lastColon === -1) ? word : word.substring(0, lastColon);
  const prefix = (lastColon === -1) ? '' : word.substring(lastColon + 1);
  const script = resolveTargetScript(target);
  if (!script) {
    return [];
  }
  const methods = listScriptMethods(script).filter(m => m.startsWith(prefix));
  return methods.map(method => `${target}:${method}`);
}

export async function complete(args) {
  const compCWord = Number.parseInt(args[0]);
  const compWords = args.slice(1);
  const word = compWords[compCWord] || '';

  const completions = [];
  if (compCWord === 1) {
    completions.push(...['config', 'make', 'watch'].filter(cmd => cmd.startsWith(word)));
  }
  completions.push(...completeDirs(word));
  completions.push(...completeScripts(word));
  completions.push(...completeFunctions(word));

  stdout.write(completions.join(' '));
}
