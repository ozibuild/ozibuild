/** @module source */
import { sourceRootPath } from './root';

import { existsSync, mkdirSync } from 'node:fs';
import { join, isAbsolute, relative, resolve, normalize } from 'node:path';
import { env } from 'node:process';
import { check } from '../util/check';
import { LogOptions } from '../util/log';
import { queryPath } from '../util/jsonpath';

import { SourceQualifiedPath, sourceRootQualifiedPath } from './qualified_path';

const DEFAULT_CONFIG = 'ozibuild.json';

/** Represents the context of a directory within source tree, which consists of:
 * 
 * - Reference to the source directory, its parent, component and the source root.
 * - Merged configuration associate to the source directory.
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

  /** Constructor used by {@link sourceDirContext}. Don't use directly. */
  constructor(root: SourceDirContext | null,
    private parent: SourceDirContext | null,
    private dir: string,
    public readonly qualifiedPath: SourceQualifiedPath) {
    this.root = root || this;
    // Default config associated to the source directory
    const defaultConfigPath = join(qualifiedPath.absolutePath, DEFAULT_CONFIG);
    this.localConfig = existsSync(defaultConfigPath) ? require(defaultConfigPath) : {};
    this.isComponent = (parent == null) || (this.localConfig.component ?? false);
    // For root, load config specified as an environment variable.
    if (this.root === this && env.OZIBUILD_CONFIG) {
      const envConfigPath = isAbsolute(env.OZIBUILD_CONFIG)
        ? env.OZIBUILD_CONFIG
        : join(qualifiedPath.absolutePath, env.OZIBUILD_CONFIG);
      const envJson = require(envConfigPath);
      this.localConfig = mergeObjects(this.localConfig, envJson);
    }
    // Ancestor overrides.
    for (let ancestor = this.parent; ancestor; ancestor = ancestor.parent) {
      const cwd = ancestor.qualifiedPath.absolutePath;
      const relativePath = relative(cwd, this.qualifiedPath.absolutePath);
      const overrides = (ancestor.localConfig.overrides || {})[relativePath] || {};
      this.localConfig = mergeObjects(this.localConfig, overrides);
    }
  }

  public readonly root: SourceDirContext;
  private localConfig: any;
  public readonly isComponent: boolean;

  /** Indicates whether this is the root of the source tree. */
  get isRoot() {
    return this.parent == null;
  }

  /** Resolves to the closest ancestor that is marked component (or root). */
  get closestComponent(): SourceDirContext {
    let comp: SourceDirContext = this;
    while (!comp.isRoot && !comp.isComponent) {
      comp = comp.parent!;
    }
    return comp;
  }

  /** Source path of this directory, relative to the source root. */
  get sourcePath() {
    return this.qualifiedPath.sourcePath;
  }

  /** Source path of the closest component, relative to the source root. */
  get componentPath() {
    return this.closestComponent.sourcePath;
  }

  /** Absolute path of this directory. */
  get absolutePath() {
    return this.qualifiedPath.absolutePath;
  }

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

  /** Selects the most specific value of configuration in the context of this config.
   * 
   * The most specific value is selected according to the following rules:
   * (1) Choose the closest config with a value set in any type of configs,
   * were the type of configs can be default, environment specific or path
   * overrides from an ancestor.
   * (2) Prefer environment config to default config: environment specific.
   * (3) Prefer overrides config to environment config.
   * (4) Prefer ancestors overrides closer to root:
   * an ancestor has more knowledge about includes,
   * while descendants should be independently of where they are included.
   */
  select(jsonPath: string): SourceDirValue {
    return this.selectInternal(jsonPath)
      || new SourceDirValue(this, jsonPath, null);
  }

  private selectInternal(jsonPath: string): SourceDirValue | null {
    let values = queryPath(this.localConfig, jsonPath);
    if (values && values.length !== 0) {
      return new SourceDirValue(this, jsonPath, values[0]);
    }
    if (this.parent) {
      return this.parent.selectInternal(jsonPath);
    }
    return null;
  }

  /** Collects all values in config in the context hierarchy. 
   * Returned values are ordered from root to leaf.
   */
  selectAll(jsonPath: string): SourceDirValue[] {
    const values: SourceDirValue[] = [];
    this.selectAllInternal(jsonPath, values);
    return values;
  }

  private selectAllInternal(jsonPath: string, values: SourceDirValue[]) {
    if (this.parent) {
      this.parent.selectAllInternal(jsonPath, values);
    }
    for (const value of queryPath(this.localConfig, jsonPath)) {
      values.push(new SourceDirValue(this, jsonPath, value));
    }
  }

  /** Special select for the absolute output directory corresponding to this source directory. 
   * 
   * - (1) Root MUST have the primary `outdir` directory, relative to source root or absolute.
   * - (2) Any other `outdir` is interpreted as relative to root's primary `outdir`,
   * overrides should correct unintended namings in the hierarchy.
   * Such `outdirs` can specify nested directories, e.g. `resources/images`.
   * - (3) For any source directory without an explicit `outdir`,
   * the output dir is its relative dir for the closest config with an `outdir`.
   */
  outputPath(mkdirs: boolean): string {
    const rootOutdir = this.root.select("$.outdir").required().value;
    const rootOutputPath = resolve(this.root.absolutePath, rootOutdir);
    let closestOutputPath = rootOutputPath;
    const relativeOutputPath = [];
    for (let ancestor: SourceDirContext = this; !ancestor.isRoot;
      ancestor = ancestor.parent!) {
      if (ancestor.localConfig.outdir) {
        closestOutputPath = resolve(rootOutputPath, ancestor.localConfig.outdir);
        break;
      }
      relativeOutputPath.push(ancestor.dir);
    }
    relativeOutputPath.reverse();
    const outputPath = join(closestOutputPath, ...relativeOutputPath);
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

  /** Creates an output sub-directory relative to the context output path. */
  outputDir(dir: string, mkdirs: boolean): string {
    const outdir = isAbsolute(dir) ? dir : join(this.outputPath(false), dir);
    if (mkdirs) {
      mkdirSync(outdir, { recursive: true });
    }
    return outdir;
  }

  relativeOutputPath(path: string): string {
    if (!isAbsolute(path)) {
      return path;
    }
    return relative(this.root.absolutePath, path);
  }

  logOptions(cwd?: string): LogOptions {
    return {
      outputRootPath: this.root.outputPath(false),
      sourceRootPath: this.root.absolutePath,
      cwd: cwd || this.sourcePath
    };
  }

  private children = new Map();

  /** Ensures the given direct sub-directory of this source path is initialized. */
  initChild(dir: string) {
    let dirConfig = this.children.get(dir);
    if (!dirConfig) {
      const childPath = this.isComponent
        ? this.qualifiedPath.qualifyRelativePath(dir)
        : this.qualifiedPath.join(dir);
      dirConfig = new SourceDirContext(this.root, this, dir, childPath);
      this.children.set(dir, dirConfig);
    }
    return dirConfig;
  }
}

/** Gets the initialized SourceConfig for the given directory. */
function initDirConfig(config: any, dirs: string[]) {
  let dirConfig = config;
  for (let i = 0; i < dirs.length; ++i) {
    dirConfig = dirConfig.initChild(dirs[i]);
  }
  return dirConfig;
}

/** Encapsulates a (configuration) value and where it occurs. */
export class SourceDirValue {
  /** Internal constructor. Use {@link SourceDirContext#select} to obtain instances of source dir. */
  constructor(
    /** Source dir where the value is specified, as context. */
    public readonly ctx: SourceDirContext,
    /** Selector used for  */
    public readonly selector: string,
    /** Actual value. */
    private selectedValue: any) { }

  /** Gets the selected value or throws an error if a value is not specified. */
  required(errorMessage?: string): SourceDirValue {
    if (this.selectedValue == null) {
      throw Error(`Missing required property: ${this.selector}: ${errorMessage || ''}`);
    }
    return this;
  }

  /** Sets the default value if there is no selected value. */
  optional(defaultValue: any): any {
    if (this.selectedValue == null) {
      this.selectedValue = defaultValue;
    }
    return this;
  }

  /**
   * @summary Gets the selected value as an absolute path to a file,
   * which is expected to be an existing file relative to the source directory.
   */
  get resolvedPath(): string {
    const resolvedPath = this.ctx.resolvePath(this.value);
    if (!existsSync(resolvedPath)) {
      throw Error(`${this.selector} requires a file that exists. ${this.value}`);
    }
    return resolvedPath;
  }

  /** Gets the selected value as output file relative to context where value was specified. */
  get outputFile(): string {
    return this.ctx.outputFile(this.value);
  }

  /** Gets the selected value as output dir relative to context where value was specified. */
  get outputDir(): string {
    return this.ctx.outputDir(this.value, true);
  }

  /** @summary Gets selected value when present, or default value otherwise. */
  get value(): any {
    return this.selectedValue || '';
  }
}

/** Global source dir context at the root of the hierarchy. */
const sourceRootContext = new SourceDirContext(null, null, '', sourceRootQualifiedPath);

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
 * @see {@link source}  for more details.
 * 
 * @summary References the source directory for ozibuild manipulation.
 */
export function sourceDirContext(sourceDirPath: string) {
  check(isAbsolute(sourceDirPath), 'Directory config initialization requires absolute paths, expected __dirname of the target source directory.');
  return initDirConfig(sourceRootContext, relative(sourceRootPath, sourceDirPath).split('/').filter(dir => dir !== ''));
}

function mergeObjects(obj1: any, obj2: any) {
  const r = { ...obj1 };
  for (const key in obj2) {
    if (obj2[key] == null) {
      r[key] = null;
    } else if (obj1[key] == null || !obj1.hasOwnProperty(key)) {
      r[key] = obj2[key];
    } else if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      r[key] = obj2[key];
    } else if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
      r[key] = mergeObjects(obj1[key], obj2[key]);
    } else {
      r[key] = obj2[key];
    }
  }
  return r;
}
