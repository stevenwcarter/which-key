import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, act } from '@testing-library/react';
import { createWhichKey } from '../engine';
import { mountWhichKey } from '../vanilla';
import { WhichKeyProvider, useShortcut, useShortcutGroup, WhichKeyPopup, ShortcutCheatsheet } from '../react';

// NB: not fileURLToPath(new URL('../../', import.meta.url)) — under this
// project's jsdom test environment, `URL` is jsdom's global implementation,
// and resolving a relative path against a file: base through it does not
// yield a file: URL (confirmed: it produces an unrelated http://localhost:3000/…
// URL instead), so fileURLToPath throws "The URL must be of scheme file".
// import.meta.dirname + node:path avoids the global URL entirely.
const root = join(import.meta.dirname, '../../') + '/';

/** The documented CSS class contract. Adding a class to a renderer means adding it here AND to both doc tables. */
const CONTRACT = [
  'wk-kbd',
  'wk-popup', 'wk-popup-host', 'wk-popup--vertical', 'wk-popup--horizontal',
  'wk-popup__header', 'wk-popup__body', 'wk-popup__list', 'wk-popup__grid',
  'wk-row', 'wk-row--group', 'wk-row__label',
  'wk-sequence', 'wk-sequence__ellipsis',
  'wk-backdrop', 'wk-cheatsheet', 'wk-cheatsheet__close', 'wk-cheatsheet__title',
  'wk-cheatsheet__sections', 'wk-cheatsheet__section',
  'wk-cheatsheet__list', 'wk-cheatsheet__list--nested', 'wk-cheatsheet__item',
  'wk-cheatsheet__group-title', 'wk-cheatsheet__group-label', 'wk-cheatsheet__hint',
] as const;

/**
 * Named exemptions to the contract above, so a special case is a lookup
 * against a documented set rather than an ad-hoc inline `.filter()`.
 *
 * VANILLA_ONLY: classes the vanilla renderer emits that React never does.
 * wk-popup-host (B18) is a structural wrapper vanilla needs to avoid
 * detach/reattach churn; React already reconciles the popup in place and
 * never had that problem, so it never emits this class.
 *
 * UNSTYLED: classes in CONTRACT that are deliberately unstyled structural
 * hooks — real, documented DOM hooks a consumer can target, but the shipped
 * default theme (src/styles.css) intentionally defines no rule for them.
 * wk-popup-host is the only one today; it is positioning-neutral by design,
 * the styled node is its `.wk-popup` child (B18/B40 review).
 */
const VANILLA_ONLY = new Set(['wk-popup-host']);
const UNSTYLED = new Set(['wk-popup-host']);

const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

const collectClasses = (): Set<string> => {
  const found = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
    for (const c of el.classList) found.add(c);
  }
  return found;
};

const renderEverything = (layout: 'vertical' | 'horizontal') => {
  const wk = createWhichKey({ timeoutMs: 10 });
  wk.registerGroup('g', { description: 'Go to' });
  wk.register('g a', vi.fn(), { description: 'Alpha' });
  wk.register('g b c', vi.fn(), { description: 'Deep' });
  wk.register('q', vi.fn(), { description: 'Quit' });
  const ui = mountWhichKey(wk, { popup: { layout } });
  wk.start();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
  vi.advanceTimersByTime(20);
  wk.openCheatsheet();
  return { wk, ui };
};

/**
 * Same surface as renderEverything above (group with a description, a leaf,
 * a nested sub-group so one candidate is a group and one is not, and a
 * standalone entry) but through the React renderer. There is no direct
 * engine handle here — WhichKeyProvider owns its engine internally — so the
 * cheatsheet is opened the same way a real consumer would: pressing the
 * default help key. It must fire *before* 'g' rather than after: the matcher
 * treats a buffered prefix plus an unrelated keystroke as "nothing matches"
 * and cancels the pending sequence (src/engine/matcher.ts, final branch), so
 * pressing '?' while 'g' is still pending would silently drop the popup
 * instead of opening the cheatsheet alongside it.
 */
const ReactFixture = ({ layout }: { layout: 'vertical' | 'horizontal' }) => {
  useShortcutGroup('g', { description: 'Go to' });
  useShortcut('g a', vi.fn(), { description: 'Alpha' });
  useShortcut('g b c', vi.fn(), { description: 'Deep' });
  useShortcut('q', vi.fn(), { description: 'Quit' });
  return (
    <>
      <WhichKeyPopup layout={layout} />
      <ShortcutCheatsheet />
    </>
  );
};

const renderReactEverything = (layout: 'vertical' | 'horizontal') => {
  const utils = render(
    <WhichKeyProvider timeoutMs={10}>
      <ReactFixture layout={layout} />
    </WhichKeyProvider>,
  );
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); });
  act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' })); });
  act(() => { vi.advanceTimersByTime(20); });
  return utils;
};

describe('CSS class contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('vanilla renderer emits exactly the documented class set across both popup layouts', () => {
    const emitted = new Set<string>();
    for (const layout of ['vertical', 'horizontal'] as const) {
      const { wk, ui } = renderEverything(layout);
      for (const c of collectClasses()) emitted.add(c);
      ui.unmount(); wk.stop(); document.body.innerHTML = '';
    }
    expect([...emitted].sort()).toEqual([...CONTRACT].sort());
  });

  // Guards against a hole the merged-set version of this test would have:
  // the two renderers hard-code their class names as separate literal
  // strings rather than sharing a source, so a class renamed or dropped in
  // only one of them must fail here on its own — asserted independently,
  // never unioned with the other renderer's set.
  it('react renderer emits exactly the documented class set across both popup layouts', () => {
    const emitted = new Set<string>();
    for (const layout of ['vertical', 'horizontal'] as const) {
      const utils = renderReactEverything(layout);
      for (const c of collectClasses()) emitted.add(c);
      utils.unmount();
      document.body.innerHTML = '';
    }
    // wk-popup-host (B18) is a vanilla-only structural wrapper: the vanilla
    // renderer needs a stable host element to avoid detach/reattach churn,
    // but React already reconciles the popup in place and never had that
    // problem, so it never emits this class. Documented in CONTRACT (and
    // both doc tables) because a consumer can still target it to override
    // stacking context in the vanilla renderer — just excluded here.
    const expected = CONTRACT.filter((c) => !VANILLA_ONLY.has(c));
    expect([...emitted].sort()).toEqual([...expected].sort());
  });

  it('documents every emitted class in README.md and docs/API.md', () => {
    const readme = readFileSync(root + 'README.md', 'utf8');
    const api = readFileSync(root + 'docs/API.md', 'utf8');
    const missingReadme = CONTRACT.filter((c) => !readme.includes(`\`${c}\``));
    const missingApi = CONTRACT.filter((c) => !api.includes(`\`${c}\``));
    expect({ missingReadme, missingApi }).toEqual({ missingReadme: [], missingApi: [] });
  });

  // [B40] wk-cheatsheet__section was emitted by both renderers with no rule
  // defined for it in src/styles.css — the shipped theme silently ignored a
  // hook it documents. This is the mechanical guard against that class of
  // drift: collect every class either renderer actually puts in the DOM
  // (reusing the same render harness and collectClasses() as the tests
  // above, not a second source-grepping mechanism) and assert the shipped
  // stylesheet defines a rule for each one, except classes named in UNSTYLED.
  it('defines a CSS rule for every emitted class that is not deliberately unstyled [B40]', () => {
    const emitted = new Set<string>();
    for (const layout of ['vertical', 'horizontal'] as const) {
      const { wk, ui } = renderEverything(layout);
      for (const c of collectClasses()) emitted.add(c);
      ui.unmount(); wk.stop(); document.body.innerHTML = '';
    }
    for (const layout of ['vertical', 'horizontal'] as const) {
      const utils = renderReactEverything(layout);
      for (const c of collectClasses()) emitted.add(c);
      utils.unmount();
      document.body.innerHTML = '';
    }
    const missing = [...emitted]
      .filter((cls) => !UNSTYLED.has(cls))
      .filter((cls) => !new RegExp(`\\.${cls}(?![\\w-])`).test(css))
      .sort();
    expect(missing).toEqual([]);
  });
});
