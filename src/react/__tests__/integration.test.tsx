import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
// ADAPTED: import from local react module instead of '@whichkey/core' alias
import { WhichKeyProvider, useShortcut, useShortcutGroup, useWhichKeyState } from '../index';
import type { WhichKeyState } from '../../engine';

afterEach(() => {
  vi.useRealTimers();
});

const Bound = ({ onN, onS }: { onN: () => void; onS: () => void }) => {
  useShortcutGroup('g', { description: 'Focus widget' });
  useShortcut('g n', onN, { description: 'Focus Notes' });
  useShortcut('g s', onS, { description: 'Focus Skills' });
  return null;
};

const Probe = ({ onState }: { onState: (s: WhichKeyState) => void }) => {
  const state = useWhichKeyState();
  onState(state);
  return null;
};

describe('integration: provider + hooks + events', () => {
  it('end-to-end: g n fires the right handler', () => {
    const onN = vi.fn();
    const onS = vi.fn();
    render(
      <WhichKeyProvider>
        <Bound onN={onN} onS={onS} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });
    expect(onN).toHaveBeenCalledOnce();
    expect(onS).not.toHaveBeenCalled();
  });

  it('useWhichKeyState surfaces candidates with correct group/leaf flags', () => {
    vi.useFakeTimers();
    let state: WhichKeyState | null = null;
    render(
      <WhichKeyProvider timeoutMs={250}>
        <Bound onN={() => {}} onS={() => {}} />
        <Probe onState={(s) => (state = s)} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(state!.visible).toBe(true);
    expect(state!.candidates.map((c) => c.nextKey).sort()).toEqual(['n', 's']);
    expect(state!.candidates.every((c) => !c.isGroup)).toBe(true);
  });
});
