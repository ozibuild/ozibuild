import { sourceDirContext } from "@ozibuild/core/context.js";
import { cwd } from 'node:process';

export function config(configFile, settings) {
  const ctx = sourceDirContext(cwd());
  if (configFile) {
    ctx.config.setAll(require(configFile));
  }
  for (const setting of settings) {
    const [key, value] = setting.split(':', 2);
    ctx.config.set(key, value);
  }
}