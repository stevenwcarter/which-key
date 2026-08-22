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
    new RegExp(
      `(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
      'm',
    ),
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
    // NB: the lookahead sits before `\s*`, not after it. `z-index:\s*(?!var\()`
    // is unsound — `\s*` backtracks to a zero-width match, so the lookahead
    // then only has to reject a literal "var(" immediately after the colon,
    // and the leading space before "var(" satisfies that trivially. That
    // false-flags every correctly-fixed `z-index: var(...)` declaration as
    // hardcoded. Anchoring the lookahead immediately after the colon (and
    // folding the optional whitespace into the lookahead itself) closes it.
    const hardcoded = css.match(/z-index:(?!\s*var\()\s*[^;]+;/g) ?? [];
    expect(hardcoded).toEqual([]);
  });

  it('documents both custom properties in the README', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('--wk-z-index');
    expect(readme).toContain('--wk-z-index-backdrop');
  });
});

describe('styles.css — theming contract [D2]', () => {
  it('defines the palette as --wk-* custom properties', () => {
    expect(css).toMatch(/--wk-panel-bg\s*:/);
    expect(css).toMatch(/--wk-text\s*:/);
  });

  it('supplies a light palette under prefers-color-scheme: light', () => {
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*light\)/);
  });

  it('lets an author force either theme with data-wk-theme', () => {
    expect(css).toMatch(/\[data-wk-theme=['"]light['"]\]/);
    expect(css).toMatch(/\[data-wk-theme=['"]dark['"]\]/);
  });

  // Regression guard for a specific documented constraint, not a generic
  // strengthening: data-wk-theme is only honoured on the document root.
  // :root matches *only* the actual root element, never an arbitrary
  // ancestor, which is what makes the attribute's placement on <html> load
  // bearing rather than a style preference. Loosening either selector to a
  // bare [data-wk-theme=...] would silently create a renderer divergence —
  // it would start working per-subtree in React (where <WhichKeyPopup/>
  // renders wherever the consumer put it) while staying broken in vanilla
  // (whose popup host is appended to document.body, outside any consumer
  // wrapper) — so this pins the :root scoping explicitly rather than relying
  // on the previous test's bare attribute-selector match to catch it.
  it('scopes both theme overrides to :root, not a looser ancestor selector', () => {
    expect(css).toMatch(/:root\[data-wk-theme=['"]light['"]\]/);
    expect(css).toMatch(/:root:not\(\[data-wk-theme=['"]dark['"]\]\)/);
  });

  it('leaves no raw hex colour outside a custom-property declaration', () => {
    const offenders = css
      .split('\n')
      .filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line))
      .filter((line) => !/--wk-[\w-]+\s*:/.test(line))
      .filter((line) => !line.trim().startsWith('/*') && !line.trim().startsWith('*'));
    expect(offenders).toEqual([]);
  });
});

// Parses a rule body's `prop: value;` declarations into a plain object, so
// two blocks can be compared by content (property names + values) rather
// than by verbatim text — order and incidental whitespace don't matter.
const parseDeclarations = (body: string): Record<string, string> => {
  const decls: Record<string, string> = {};
  for (const statement of body.split(';')) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    decls[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }
  return decls;
};

describe('styles.css — the two light-palette blocks stay in sync', () => {
  // Ruling 3 deliberately duplicates the 13 light declarations verbatim
  // (plain CSS cannot share a property block across two selectors, and
  // light-dark() would raise the browser floor — see the comment above
  // `:root[data-wk-theme='light']` in styles.css). Nothing else pins that
  // the two copies agree: edit one and not the other and OS-light users
  // silently get a different palette from data-wk-theme="light" users, with
  // every other test in this suite still green.
  it('declares the same custom properties with the same values in both blocks', () => {
    const mediaMatch = css.match(
      /@media\s*\(prefers-color-scheme:\s*light\)\s*\{\s*:root:not\(\[data-wk-theme=['"]dark['"]\]\)\s*\{([^}]*)\}\s*\}/,
    );
    const forcedMatch = css.match(/:root\[data-wk-theme=['"]light['"]\]\s*\{([^}]*)\}/);
    if (!mediaMatch || !forcedMatch) {
      throw new Error('could not locate both light-palette rule bodies in styles.css');
    }

    const mediaDecls = parseDeclarations(mediaMatch[1]);
    const forcedDecls = parseDeclarations(forcedMatch[1]);

    // Sanity check the extraction itself found real declarations, so a
    // regex that silently matched nothing can't make this pass vacuously.
    expect(Object.keys(mediaDecls).length).toBeGreaterThan(0);

    expect(forcedDecls).toEqual(mediaDecls);
  });
});
