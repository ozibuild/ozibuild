import { existsSync, mkdirSync } from "node:fs";
import { SourceDirContext } from "../core/context";
import { build } from "../make/cmd";
import { join } from 'node:path';

export async function cmakeGitLib(ctx: SourceDirContext, name: string, gitUrl: string): Promise<string> {
  const cwd = ctx.outputPath(true);
  const dir = join(cwd, name);
  if (existsSync(dir)) {
    await build(ctx, { dir }, { cmd: ['git', 'pull'], cwd: dir });
  } else {
    await build(ctx, { dir }, { cmd: ['git', 'clone', gitUrl], cwd });
  }
  const buildDir = join(dir, 'build');
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true });
  }
  await build(ctx, { label: name }, { cmd: ['cmake', '..'], cwd: buildDir });
  await build(ctx, { label: name }, { cmd: ['make', '-j'], cwd: buildDir });
  return dir;
}
