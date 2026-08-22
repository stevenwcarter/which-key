import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, act } from '@testing-library/react';
import { useEngineSnapshot } from '../useEngineSnapshot';
import { resetNoProviderWarnings } from '../context';
import type { WhichKeySnapshot } from '../../engine';

describe('useEngineSnapshot with no engine', () => {
  beforeEach(() => resetNoProviderWarnings());

  // CLAUDE.md's snapshot-identity invariant: useSyncExternalStore compares the
  // getSnapshot result by identity, so a fallback built fresh per call would
  // re-render forever. Two renderers now share this one hoisted sentinel, so
  // the rule is pinned here rather than in either renderer's suite.
  it('returns the identical fallback object on every re-render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seen: WhichKeySnapshot[] = [];
    let bump = () => {};
    const Probe = () => {
      const [, setN] = useState(0);
      bump = () => setN((n) => n + 1);
      seen.push(useEngineSnapshot(null, '<Probe>'));
      return null;
    };
    render(<Probe />);
    act(() => bump());
    act(() => bump());
    warn.mockRestore();

    expect(seen.length).toBeGreaterThanOrEqual(3);
    for (const s of seen) expect(s).toBe(seen[0]);
  });

  it('falls back to an invisible snapshot instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let snapshot: WhichKeySnapshot | undefined;
    const Probe = () => {
      snapshot = useEngineSnapshot(null, '<Probe>');
      return null;
    };
    render(<Probe />);
    warn.mockRestore();

    expect(snapshot).toEqual({
      popup: { visible: false, currentSequence: [], candidates: [] },
      cheatsheet: { visible: false },
    });
  });
});
