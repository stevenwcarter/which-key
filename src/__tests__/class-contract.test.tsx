import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWhichKey } from '../engine';
import { mountWhichKey } from '../vanilla';

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
  'wk-popup', 'wk-popup--vertical', 'wk-popup--horizontal',
  'wk-popup__header', 'wk-popup__body', 'wk-popup__list', 'wk-popup__grid',
  'wk-row', 'wk-row--group', 'wk-row__label',
  'wk-sequence', 'wk-sequence__ellipsis',
  'wk-backdrop', 'wk-cheatsheet', 'wk-cheatsheet__close', 'wk-cheatsheet__title',
  'wk-cheatsheet__sections', 'wk-cheatsheet__section',
  'wk-cheatsheet__list', 'wk-cheatsheet__list--nested', 'wk-cheatsheet__item',
  'wk-cheatsheet__group-title', 'wk-cheatsheet__group-label', 'wk-cheatsheet__hint',
] as const;

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

describe('CSS class contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('emits exactly the documented class set across both popup layouts', () => {
    const emitted = new Set<string>();
    for (const layout of ['vertical', 'horizontal'] as const) {
      const { wk, ui } = renderEverything(layout);
      for (const c of collectClasses()) emitted.add(c);
      ui.unmount(); wk.stop(); document.body.innerHTML = '';
    }
    expect([...emitted].sort()).toEqual([...CONTRACT].sort());
  });

  it('documents every emitted class in README.md and docs/API.md', () => {
    const readme = readFileSync(root + 'README.md', 'utf8');
    const api = readFileSync(root + 'docs/API.md', 'utf8');
    const missingReadme = CONTRACT.filter((c) => !readme.includes(`\`${c}\``));
    const missingApi = CONTRACT.filter((c) => !api.includes(`\`${c}\``));
    expect({ missingReadme, missingApi }).toEqual({ missingReadme: [], missingApi: [] });
  });
});
