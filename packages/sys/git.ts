import { SourceDirContext } from "../core/context";
import { build } from "../make/cmd";

import { join } from "node:path";
import { existsSync } from "node:fs";

/** Clones a git repository.
 *
 * @param ctx source context, repository is cloned into {@link SourceDirContext.outputDir}
 * @param repository name of the repository, the output directory name.
 * @param params.url repository url
 * @param params.branch instructs to clone to a certain branch
 * @param params.tag instructs to clone to a certain tag
 * @returns the full path to the directory containing cloned repository
 */
export async function git(
  ctx: SourceDirContext,
  repository: string,
  params: {
    url: string;
    branch?: string;
    tag?: string;
  },
): Promise<string> {
  const cwd = ctx.outputPath(true);
  const dir = join(cwd, repository);
  if (existsSync(dir)) {
    if (params.branch || params.tag) {
      await build(
        ctx,
        { dir },
        {
          cmd: ["git", "checkout", params.branch || params.tag || ""],
          cwd: dir,
        },
      );
      await build(
        ctx,
        { dir },
        {
          cmd: ["git", "pull", "origin", params.branch || params.tag || ""],
          cwd: dir,
        },
      );
    } else {
      await build(ctx, { dir }, { cmd: ["git", "pull"], cwd: dir });
    }
  } else {
    const cmd = ["git", "clone", params.url, repository];
    if (params.branch) {
      cmd.push(`--branch=${params.branch}`);
    }
    await build(ctx, { dir }, { cmd, cwd });
  }
  return dir;
}
