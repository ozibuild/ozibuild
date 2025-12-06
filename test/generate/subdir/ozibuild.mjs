import { sourceDirContext } from "@ozibuild/core/context.js";
import { cachedCmd } from "@ozibuild/make/cache.js";

const ctx = sourceDirContext(import.meta.dirname);

export async function generateTextOut() {
  const input = ctx.resolvePath("input.txt");
  return cachedCmd(ctx, {
    outfile: "out.txt",
    stdoutfile: true,
    deps: [input],
    bin: "sed",
    args: ["s/World/Sun/g", input]
  });
}