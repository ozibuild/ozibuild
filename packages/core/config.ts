import { existsSync, writeFileSync } from "node:fs";

/**
 * @summary Manages configuration object hierarchy for build purposes.
 */
export class OzibuildConfig {
  constructor(private path: string) {
    // Initialize the configuration with default values or load from a file.
    this.json = existsSync(path) ? require(path) : {};
  }

  private json: any;

  /** Gets a setting, throws an error when setting is not specified. */
  getRequired(objectPath: string): any {
    const value = this.getOptional(objectPath);
    if (value === undefined) {
      throw new Error(`Missing required configuration setting: ${objectPath}`);
    }
    return value;
  }

  /** Gets a setting, falls back to defaultValue when setting is not specified. */
  getOptional(objectPath: string, defaultValue?: any): any {
    const parts = objectPath.split(".");
    let current = this.json;
    for (const part of parts) {
      current = current[part];
      if (current == null) {
        break;
      }
    }
    return current ?? defaultValue;
  }

  /** Special case: outdir */
  get outdir(): string {
    return this.getOptional("outdir", ".ozibuild/dist");
  }

  /** Sets a value */
  setDefault(objectPath: string, value: any) {}

  setAll(config: any) {
    writeFileSync(this.path, JSON.stringify(config));
  }

  set(objectPath: string, value: any) {
    const parts = objectPath.split(".");
    let current = this.json;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = autoCast(value);
    writeFileSync(this.path, JSON.stringify(this.json));
  }

  /** When used settings are not specified, creates the json path in the config.
   *
   * @useDefaults indicates to use the default value when creating settings that
   *      are not specified, otherwise creates nulls.
   */
  generateDefaults(useDefaults: boolean) {}
}

function autoCast(value: any): any {
  if (typeof value !== "string") {
    return value;
  }
  if (/^[0-9]+$/.test(value)) {
    return parseInt(value);
  }
  if (/^[0-9]*\.?[0-9]+$/.test(value)) {
    return parseFloat(value);
  }
  if (value === "true" || value === "false") {
    return value === "true";
  }
  return value;
}
