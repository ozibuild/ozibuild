import { sourceDirContext } from "@ozibuild/core/context.js";
import { buildCmd } from "@ozibuild/make/cmd.js";

const ctx = sourceDirContext(import.meta.dirname);

export async function helloWorld() {
  return await buildCmd(ctx, {
    bin: 'echo',
    args: ['Hello, World!']
});
}
