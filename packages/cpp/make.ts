import { existsSync, mkdirSync } from "node:fs";
import { SourceDirContext } from "../core/context";
import { build, objargs } from "../make/cmd";
import { join } from "node:path";
import { cachedCmd } from "@ozibuild/make";

export async function make(
  ctx: SourceDirContext,
  name: string,
  params: {
    dir: string;
    configure?: any;
    targets?: string[];
    install?: boolean;
  },
): Promise<string> {
  const cwd = ctx.outputPath(true);
  const dir = params.dir;
  await cachedCmd(
    ctx,
    { file: join(dir, "Makefile") },
    {
      deps: [join(dir, "configure")],
      cmd: ["./configure"].concat(objargs(params.configure || {})),
      cwd: dir,
    },
  );
  await build(
    ctx,
    { label: `make ${name}` },
    { cmd: ["make", "-j"].concat(params.targets || []), cwd: dir },
  );
  if (params.install) {
    await build(
      ctx,
      { label: `make install ${name}` },
      { cmd: ["make", "install"], cwd: dir },
    );
  }
  return dir;
}
