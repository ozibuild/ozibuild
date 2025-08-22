import { sourceRootPath } from './root';
import { check } from '../util/check';

import { join, normalize } from 'node:path';

/** Represents a qualified path within the source tree, relative to source root. 
 *
 * A qualified path consists of 
 * a hierarchy of path segments to directories that represents components
 * and a relative path to the target directory within its closest component.
 */
export class SourceQualifiedPath {
  
  constructor(
    /** For each component, its path relative to enclosing component. */
    public readonly components: string[], 
    /** Relative path within the closest component. */
    public readonly relativePath: string) {
  }

  /** Gets the qualified path for the enclosing component. */
  get componentPath() {
    return new SourceQualifiedPath(this.components.slice(0, -1), this.components[this.components.length - 1]);
  }

  /** Translates the qualified path to a path relative to source root. */
  get sourcePath() {
    return join(...this.components, this.relativePath);
  }

  /** Translates the qualified path to an absolute path. */
  get absolutePath() {
    return join(sourceRootPath, this.sourcePath);
  }

  /** Given this is a qualified path for a component, 
   * creates a qualified path for a directory within the component. */
  qualifyRelativePath(componentRelativePath: string) {
    let relativePath = normalize(componentRelativePath);
    check(!relativePath.startsWith('..'), 
        `Relative path [${componentRelativePath}] expected within component boundaries (${this.sourcePath})`);
    return new SourceQualifiedPath([...this.components, this.relativePath], relativePath);
  }

  /** Creates a copy of this instance which extended sourcePath */
  join(relativePath: string) {
    return new SourceQualifiedPath(this.components, normalize(join(this.relativePath, relativePath)));
  }

  /** Checks if givent qualified path points to the same source path. */
  equals(other: SourceQualifiedPath) {
    if (other.components.length !== this.components.length) {
      return false;
    }
    if (this.relativePath !== other.relativePath) {
      return false;
    }
    for (let i = 0; i < this.components.length; ++i) {
      if (this.components[i] !== other.components[i]) {
        return false;
      }
    }
    return true;
  }
}

/** @internal */
export const sourceRootQualifiedPath = new SourceQualifiedPath([], '');
