import { readFileSync,  } from 'node:fs';
import { createHash } from 'node:crypto';

export function checksum(filePath: string) {
  try {
    const content = readFileSync(filePath);
    return createHash('md5').update(content).digest('hex');
  } catch (e) {
    return 'error';
  }
}
