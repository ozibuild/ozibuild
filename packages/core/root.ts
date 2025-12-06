/**
 * @summary  Entry point for the source hierarchy. 
 */

import { existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const ROOT_SCRIPTS = ['ozibuild.root', 'ozibuild-root', 'ozibuild_root', 'root'];
const JS_EXT = ['js', 'mjs', 'cjs'];

export function isRootPath(path: string) {
  if (existsSync(join(path, '.ozibuild'))) {
    return true;
  }
  for (const script of ROOT_SCRIPTS) {
    for (const ext of JS_EXT) {
      if (existsSync(join(path, `${script}.${ext}`))) {
        return true;
      }
    }
  }
  return false;
}

export function findRootPath(path: string) {
  let rootPath = normalize(path);
  while (rootPath && rootPath !== '/') {
    if (isRootPath(rootPath)) {
      return rootPath;
    }
    rootPath = dirname(rootPath);
  }
  return null;
}
