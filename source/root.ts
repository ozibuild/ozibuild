/** @module source
 * @summary  Entry point for the source hierarchy. */
import {existsSync} from 'node:fs';
import {dirname, join, normalize} from 'node:path';

import { cwd } from 'node:process';

/** Root of the source hierarchy.
 * 
 * It is either the closest package from the main script being executed,
 * or the closest package from the current path.
 * 
 * Using closest package allows to build git submodules either
 * in the context of the submodule or in the context of enclosing repository.
 */
export const sourceRootPath = discoverSourceRootPath();

function packagePath(path: string) {
  let packagePath = normalize(path);
  while (packagePath && packagePath !== '/'
    && !existsSync(join(packagePath, 'package.json'))) {
    packagePath = dirname(packagePath);
  }
  return packagePath;
}

function discoverSourceRootPath() {
  // Source root is primarily the package root for the target script.
  let rootPath = packagePath(cwd());
  // When a package is invoked from a container package,
  // prefer the container as root.
  if (rootPath.startsWith(cwd()) && rootPath !== cwd()) {
    rootPath = packagePath(cwd());
  }
  return rootPath;
}
