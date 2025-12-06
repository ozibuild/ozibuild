/** @module core */
import { findRootPath } from './root';

import { mkdirSync } from 'node:fs';
import { join, isAbsolute, relative, resolve, normalize } from 'node:path';
import { OzibuildConfig } from './config';
import { check } from './check';

/** Represents the context of a directory within source tree, which consists of:
 * 
 * - Reference to the source directory, its parent and the source root.
 * - Access to configuration(s).
 * - Resolved output directory configured for the source directory.
 * 
 * Most tools use the SourceDirContext for locating inputs in source tree
 * and derive the path of target outputs.
 * 
 * It is expected to be initiated only in the scripts for the source directory,
 * see {@link sourceDirContext} for examples.
 * 
 * @summary Represents the context of a source directory.
 */
export class SourceDirContext {

  /** Constructor used by {@link sourceDirContext}. Don't use directly.
   * 
   * @param root root context containing this source context. null for root
   * @param parent direct parent context for this source context. null for root.
   * @param path absolute path for root or relative path for non-root.
   */
  constructor(root: SourceDirContext | null,
    parent: SourceDirContext | null,
    path: string) {
    this.root = root || this;
    if (this.root === this) {
      this.parent = undefined;
      this.absolutePath = path;
      this.sourcePath = '.';
      this.config = new OzibuildConfig(join(path, '.ozibuild/config.json'));
    } else {
      this.parent = parent!;
      this.absolutePath = join(this.root.absolutePath, path);
      this.sourcePath = path;
      this.config = this.root.config;
    }
  }

  public readonly root: SourceDirContext;

  /** Indicates whether this is the root of the source tree. */
  get isRoot() {
    return this.root === this;
  }

  public readonly parent?: SourceDirContext;

  public readonly absolutePath: string;
  public readonly sourcePath: string;

  public readonly config: OzibuildConfig;

  /**
   * Resolves a path relative to this source directory to an absolute path.
   * If the given path is already absolute, no changes are made.
   * 
   * @param relativePath path to resolve, relative to this directory or absolute.
   * @return resolved absolute path.
   */
  resolvePath(relativePath: string) {
    if (isAbsolute(relativePath)) {
      return relativePath;
    }
    return normalize(join(this.absolutePath, relativePath));
  }

  /**  */
  outputPath(mkdirs: boolean): string {
    const rootOutdir = this.config.outdir;
    const rootOutputPath = resolve(this.root.absolutePath, rootOutdir);
    const outputPath = join(rootOutputPath, this.sourcePath);
    if (mkdirs) {
      mkdirSync(outputPath, { recursive: true });
    }
    return outputPath;
  }

  /** Computes the full part of a filename relative to the output path. */
  outputFile(filename: string): string {
    if (isAbsolute(filename)) {
      return filename;
    }
    return join(this.outputPath(true), filename);
  }

  get cachePath() {
    return join(this.root.absolutePath, '.ozibuild/cache', this.sourcePath);
  }

  get logPath() {
    return join(this.root.absolutePath, '.ozibuild/log', this.sourcePath);
  }

  private children = new Map();

  /** Ensures the given direct sub-directory of this source path is initialized. */
  initChild(dir: string) {
    let dirConfig = this.children.get(dir);
    if (!dirConfig) {
      dirConfig = new SourceDirContext(this.root, this, join(this.sourcePath, dir));
      this.children.set(dir, dirConfig);
    }
    return dirConfig;
  }
}

/** Gets the initialized SourceConfig for the given directory. */
function initSourceDirContext(root: SourceDirContext, sourcePath: string) {
  let dirContext = root;
  for (const dir of sourcePath.split('/')) {
    dirContext = dirContext.initChild(dir);
  }
  return dirContext;
}

/** Global source dir context at the root of the hierarchy. */
const rootContexts = new Map<string, SourceDirContext>();

function getRootContext(rootPath: string) {
  if (!rootContexts.has(rootPath)) {
    rootContexts.set(rootPath, new SourceDirContext(null, null, rootPath));
  }
  return rootContexts.get(rootPath)!;
}

/** Gets the {@link SourceDirContext} for the given source directory.
 * 
 * Recommended Usage:
 * 
 * ```js
 * // ozibuild.cjs
 * const { sourceDirContext } = require('ozibuild/source');
 * const ctx = sourceDirContext(__dirname);
 * ```
 * 
 * ```js
 * // ozibuild.mjs
 * import { sourceDirContext } from 'ozibuild/source';
 * const ctx = sourceDirContext(import.meta.dirname);
 * ```
 * 
 * @summary References the source directory for ozibuild manipulation.
 */
export function sourceDirContext(sourceDirPath: string) {
  check(isAbsolute(sourceDirPath), 'Directory initialization requires absolute paths, use __dirname or import.meta.dirname of the target source directory.');
  const rootPath = findRootPath(sourceDirPath);
  check(rootPath != null, `Cannot find root for '${sourceDirPath}'. Ensure .ozibuild directory at the root level.`);
  return initSourceDirContext(getRootContext(rootPath!), relative(rootPath!, sourceDirPath));
}
