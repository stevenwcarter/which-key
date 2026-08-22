// There is no CSS-rendering test infrastructure in this repo, and jsdom does
// no cascade or stacking of its own. The honest guard here is a text
// assertion over the shipped stylesheet's source, following the existing
// src/engine/__tests__/package-exports.test.ts precedent of asserting over
// file contents rather than runtime layout. This file covers only the
// overlay z-index custom-property contract [B26]; it does not scan emitted
// classes — that mechanical check lives in src/__tests__/class-contract.test.tsx
// (Task 19), not here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

/** Body of the first rule whose selector list exactly matches `selector`. */
const ruleBody = (selector: string): string => {
  const match = css.match(
    new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm'),
  );
  if (!match) throw new Error(`No rule found for selector ${selector}`);
  return match[2];
};

describe('styles.css — overlay stacking contract [B26]', () => {
  it('resolves the popup z-index through --wk-z-index', () => {
    expect(ruleBody('.wk-popup')).toMatch(/z-index:\s*var\(--wk-z-index,\s*1000\)/);
  });

  it('resolves the backdrop z-index through --wk-z-index-backdrop falling back to --wk-z-index', () => {
    expect(ruleBody('.wk-backdrop')).toMatch(
      /z-index:\s*var\(--wk-z-index-backdrop,\s*var\(--wk-z-index,\s*1000\)\)/,
    );
  });

  it('has no hardcoded z-index left anywhere in the sheet', () => {
    const hardcoded = css.match(/z-index:\s*(?!var\()[^;]+;/g) ?? [];
    expect(hardcoded).toEqual([]);
  });

  it('documents both custom properties in the README', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('--wk-z-index');
    expect(readme).toContain('--wk-z-index-backdrop');
  });
});
