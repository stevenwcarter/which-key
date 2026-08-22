import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../../') + '/';
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8')) as {
  exports: Record<string, unknown>;
};
const SUBPATHS = ['.', './react', './vanilla'] as const;

describe('package exports', () => {
  it('declares nested per-format conditions with types first', () => {
    for (const sub of SUBPATHS) {
      const entry = pkg.exports[sub] as Record<string, Record<string, string>>;
      expect(Object.keys(entry)).toEqual(['import', 'require']);
      expect(Object.keys(entry.import)).toEqual(['types', 'default']);
      expect(Object.keys(entry.require)).toEqual(['types', 'default']);
      expect(entry.import.types).toMatch(/\.d\.ts$/);
      expect(entry.import.default).toMatch(/\.js$/);
      expect(entry.require.types).toMatch(/\.d\.cts$/);
      expect(entry.require.default).toMatch(/\.cjs$/);
    }
  });

  it('still exports the stylesheet', () => {
    expect(pkg.exports['./styles.css']).toBe('./dist/styles.css');
  });

  it.skipIf(!existsSync(root + 'dist'))('points every condition at a file that exists', () => {
    const targets: string[] = [];
    for (const sub of SUBPATHS) {
      const entry = pkg.exports[sub] as Record<string, Record<string, string>>;
      targets.push(
        entry.import.types,
        entry.import.default,
        entry.require.types,
        entry.require.default,
      );
    }
    targets.push(pkg.exports['./styles.css'] as string);
    for (const t of targets) {
      expect({ target: t, exists: existsSync(root + t.replace(/^\.\//, '')) }).toEqual({
        target: t,
        exists: true,
      });
    }
  });
});
