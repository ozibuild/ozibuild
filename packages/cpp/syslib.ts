import { SpawnOptions } from "node:child_process";

import { cmd } from "@ozibuild/make";
import { SourceDirContext } from "@ozibuild/core";
import { CppLibrary } from "./cpp_lang";

export async function pkgConfig(
  ctx: SourceDirContext,
  module: string,
): Promise<CppLibrary> {
  const pkgConfigOpts: SpawnOptions = {
    cwd: ctx.absolutePath, // Run from source directory to get relative includes and lib dirs
  };
  const libInfo: CppLibrary = { cflags: [], ldflags: [] };
  const cmd1 = cmd("pkg-config", ["--cflags", module], pkgConfigOpts).then(
    (cflags: string) =>
      (libInfo.cflags = cflags
        .split(" ")
        .map((cflag) => cflag.trim())
        .filter((cflag) => !!cflag)),
  );
  const cmd2 = cmd("pkg-config", ["--libs", module], pkgConfigOpts).then(
    (ldflags: string) =>
      (libInfo.ldflags = ldflags
        .split(" ")
        .map((ldflag) => ldflag.trim())
        .filter((ldflag) => !!ldflag)),
  );
  return Promise.all([cmd1, cmd2]).then(() => libInfo);
}
