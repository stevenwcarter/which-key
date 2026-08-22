import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { useShortcut } from '../useShortcut';
import { useWhichKeyState } from '../useWhichKeyState';
import { resetNoProviderWarnings } from '../context';
import type { WhichKeyState } from '../../engine';

afterEach(() => {
  vi.useRealTimers();
});

const Probe = ({ onState }: { onState: (s: WhichKeyState) => void }) => {
  const state = useWhichKeyState();
  onState(state);
  return null;
};

const Bound = () => {
  useShortcut('g n', () => {}, { description: 'Notes' });
  useShortcut('g s', () => {}, { description: 'Skills' });
  return null;
};

describe('useWhichKeyState', () => {
  it('returns hidden state initially', () => {
    let state: WhichKeyState | null = null;
    render(
      <WhichKeyProvider>
        <Probe onState={(s) => (state = s)} />
      </WhichKeyProvider>,
    );
    expect(state).toMatchObject({ visible: false, currentSequence: [], candidates: [] });
    expect(typeof state!.cancel).toBe('function');
  });

  it('exposes candidates after popup becomes visible', () => {
    vi.useFakeTimers();
    let lastState: WhichKeyState | null = null;
    render(
      <WhichKeyProvider timeoutMs={300}>
        <Bound />
        <Probe onState={(s) => (lastState = s)} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(lastState!.visible).toBe(true);
    expect(lastState!.currentSequence).toEqual(['g']);
    expect(lastState!.candidates).toHaveLength(2);
    expect(lastState!.candidates.map((c) => c.nextKey).sort()).toEqual(['n', 's']);
  });

  it('preserves registration order when sortKeys is unset', () => {
    vi.useFakeTimers();
    let lastState: WhichKeyState | null = null;
    const SeededBound = () => {
      useShortcut('g s', () => {}, { description: 'Skills' });
      useShortcut('g a', () => {}, { description: 'Abilities' });
      useShortcut('g n', () => {}, { description: 'Notes' });
      return null;
    };
    render(
      <WhichKeyProvider timeoutMs={50}>
        <SeededBound />
        <Probe onState={(s) => (lastState = s)} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(lastState!.candidates.map((c) => c.nextKey)).toEqual(['s', 'a', 'n']);
  });

  it('sorts candidates alphabetically when sortKeys="alphabetical"', () => {
    vi.useFakeTimers();
    let lastState: WhichKeyState | null = null;
    const SeededBound = () => {
      useShortcut('g s', () => {}, { description: 'Skills' });
      useShortcut('g a', () => {}, { description: 'Abilities' });
      useShortcut('g n', () => {}, { description: 'Notes' });
      useShortcut('g N', () => {}, { description: 'Notes (alias)' });
      return null;
    };
    render(
      <WhichKeyProvider timeoutMs={50} sortKeys="alphabetical">
        <SeededBound />
        <Probe onState={(s) => (lastState = s)} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // Lowercase before uppercase within the same letter; alphabetical otherwise.
    expect(lastState!.candidates.map((c) => c.nextKey)).toEqual(['a', 'n', 'N', 's']);
  });
});

describe('useWhichKeyState outside a provider [B24]', () => {
  beforeEach(() => resetNoProviderWarnings());

  it('warns with the default label when called without a "what" argument', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Probe onState={() => {}} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('useWhichKeyState()'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('outside <WhichKeyProvider>'));
    warn.mockRestore();
  });
});
