import { existsSync, mkdirSync } from "node:fs";
import { SourceDirContext } from "../core/context";
import { build } from "../make/cmd";
import { join } from "node:path";

export async function cmakeGitLib(
  ctx: SourceDirContext,
  name: string,
  params: {
    gitUrl: string;
    gitBranch?: string;
    cmakeDefs?: any;
    makeTargets?: string[];
  },
): Promise<string> {
  const cwd = ctx.outputPath(true);
  const dir = join(cwd, name);
  if (existsSync(dir)) {
    if (params.gitBranch) {
      await build(
        ctx,
        { dir },
        { cmd: ["git", "checkout", params.gitBranch], cwd: dir },
      );
    }
    await build(ctx, { dir }, { cmd: ["git", "pull"], cwd: dir });
  } else {
    const cmd = ["git", "clone", params.gitUrl];
    if (params.gitBranch) {
      cmd.push(`--branch=${params.gitBranch}`);
    }
    await build(ctx, { dir }, { cmd, cwd });
  }
  const buildDir = join(dir, "build");
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true });
  }
  await build(
    ctx,
    { label: `cmake configure ${name}` },
    {
      cmd: ["cmake", ".."].concat(cmakeDefsFlags(params.cmakeDefs)),
      cwd: buildDir,
    },
  );
  await build(
    ctx,
    { label: `make ${name}` },
    { cmd: ["make", "-j"].concat(params.makeTargets || []), cwd: buildDir },
  );
  return dir;
}

function cmakeDefsFlags(defs?: any): string[] {
  if (!defs) {
    return [];
  }
  const flags: string[] = [];
  for (const def in defs) {
    flags.push(`-D${def}=${defs[def]}`);
  }
  return flags;
}
