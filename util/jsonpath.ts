/** 
 * 
 * @param o 
 * @param jsonPath 
 */
export function queryPath(o: any, jsonPath: string): any[] {
  let parts:string[] = jsonPath.split('.');
  if (parts[0] == '$') {
    parts.shift();
  }
  let p: any[] = [o];
  for (let part of parts) {
    let pp: any[] = [];
    for (let po of p) {
      if (part.endsWith('[*]')) {
        part = part.substring(0, part.length - 3);
      }
      if (po[part] != null) {
        if (Array.isArray(po[part])) {
          pp.push(...po[part]);
        } else {
          pp.push(po[part]);
        }
      }
      p = pp;
    }
  }
  return p;
}