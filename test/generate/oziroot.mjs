import { sourceDirContext } from "@ozibuild/core/context.js";
import { cachedCmd } from "@ozibuild/make/cache.js";
import { generateTextOut } from "./subdir/ozibuild.mjs";

const ctx = sourceDirContext(import.meta.dirname);

export async function extendTextOut() {
  const input = await generateTextOut();
  return cachedCmd(ctx, { file: 'out-extended.txt', stdout: true }, {
    deps: [input],
    cmd: ["sed", "s/Sun/Galaxy/g", input]
  })
}
