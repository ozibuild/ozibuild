/** Given a list of string, keeps only first occurence of duplicate values. */
export function dedupe(a: string[]): string[] {
    const s = new Map();
    a.forEach(e => s.set(e, (s.get(e) || 0) + 1));
    return a.filter(e => {
        const c = s.get(e) - 1;
        s.set(e, c);
        return c === 0;
    });
}
