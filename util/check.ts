import { prefixError } from "./log";

/** 
 * Checks that the given condition is true,
 * otherwise exit process with error. 
 */
export function check(condition: boolean, message: string) {
  if (!condition) {
    prefixError('check failed', message);
    throw Error(`Check failed: ${message}`);
  }
}
