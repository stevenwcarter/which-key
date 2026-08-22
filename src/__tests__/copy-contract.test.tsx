import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, act } from '@testing-library/react';
import { createWhichKey } from '../engine';
import { mountWhichKey } from '../vanilla';
import { WhichKeyProvider, useShortcut, WhichKeyPopup, ShortcutCheatsheet } from '../react';
import { CHEATSHEET_HINT, NO_DESCRIPTION, SHORTCUTS_LABEL } from '../shared/strings';

const root = join(import.meta.dirname, '../../') + '/';

/**
 * The documented cross-renderer copy contract, the string sibling of
 * src/__tests__/class-contract.test.tsx's CONTRACT. Both renderers must show
 * every one of these, and neither may re-inline the literal.
 */
const COPY = [NO_DESCRIPTION, SHORTCUTS_LABEL, CHEATSHEET_HINT] as const;

const sourcesUnder = (dir: string): string[] =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'))
    .map((f) => join(root, dir, f));

// Deliberately src/react + src/vanilla only: src/engine/registry.ts has its own
// '(no description)' in a console.warn, which is diagnostic text on a different
// contract and stays inlined there.
const RENDERER_SOURCES = [...sourcesUnder('src/react'), ...sourcesUnder('src/vanilla')];

const visibleCopy = (): string[] => {
  const seen = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
    const label = el.getAttribute('aria-label');
    if (label) seen.add(label);
  }
  const text = document.body.textContent ?? '';
  return [...COPY].filter((s) => text.includes(s) || seen.has(s));
};

describe('cross-renderer copy contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('vanilla renderer shows every shared string', () => {
    const wk = createWhichKey({ timeoutMs: 10 });
    wk.register('g a', vi.fn());
    const ui = mountWhichKey(wk);
    wk.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    vi.advanceTimersByTime(20);
    wk.openCheatsheet();
    const shown = visibleCopy();
    ui.unmount();
    wk.stop();
    expect(shown.sort()).toEqual([...COPY].sort());
  });

  it('react renderer shows every shared string', () => {
    const Fixture = () => {
      useShortcut('g a', vi.fn());
      return (
        <>
          <WhichKeyPopup />
          <ShortcutCheatsheet />
        </>
      );
    };
    const utils = render(
      <WhichKeyProvider timeoutMs={10}>
        <Fixture />
      </WhichKeyProvider>,
    );
    // '?' before 'g': the matcher cancels a pending sequence on an unrelated
    // key, so pressing '?' while 'g' is buffered would drop the popup instead
    // of opening the cheatsheet alongside it (same ordering as class-contract).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    const shown = visibleCopy();
    utils.unmount();
    expect(shown.sort()).toEqual([...COPY].sort());
  });

  it('leaves no renderer source re-inlining a shared string literal', () => {
    const offenders = RENDERER_SOURCES.filter((file) => {
      const src = readFileSync(file, 'utf8');
      return COPY.some((s) => src.includes(s));
    }).map((f) => f.slice(root.length));
    expect(offenders).toEqual([]);
  });
});
