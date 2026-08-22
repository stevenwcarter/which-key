import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useContext, useEffect, useSyncExternalStore } from 'react';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { WhichKeyContext } from '../context';
import { useShortcut } from '../useShortcut';
import type { WhichKeyEngine } from '../../engine';

// Adaptation note: the old context held a {registry, popupState, cancel, cheatsheetVisible,
// openCheatsheet, closeCheatsheet} value object. The new context holds the WhichKeyEngine
// directly. Tests that probed context shape have been updated to use the engine's public API:
//   - ctx.registry          → ctx.registry          (unchanged, engine.registry)
//   - ctx.popupState        → ctx.getSnapshot().popup
//   - ctx.cancel            → ctx.cancel             (unchanged, engine.cancel)
//   - ctx.cheatsheetVisible → ctx.getSnapshot().cheatsheet.visible
//   - ctx.openCheatsheet    → ctx.openCheatsheet     (unchanged, engine.openCheatsheet)
//   - ctx.closeCheatsheet   → ctx.closeCheatsheet    (unchanged, engine.closeCheatsheet)

const Probe = ({ onCtx }: { onCtx: (ctx: WhichKeyEngine | null) => void }) => {
  const ctx = useContext(WhichKeyContext);
  useEffect(() => {
    onCtx(ctx);
  });
  return null;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('WhichKeyProvider', () => {
  it('exposes a registry and initial popup state via context', () => {
    let captured: WhichKeyEngine | null = null;
    render(
      <WhichKeyProvider>
        <Probe onCtx={(c) => (captured = c)} />
      </WhichKeyProvider>,
    );
    expect(captured).not.toBeNull();
    // ADAPTED: engine.registry replaces ctx.registry
    expect(captured!.registry).toBeDefined();
    // ADAPTED: engine.getSnapshot().popup replaces ctx.popupState
    expect(captured!.getSnapshot().popup).toEqual({
      visible: false,
      currentSequence: [],
      candidates: [],
    });
    // ADAPTED: engine.cancel replaces ctx.cancel
    expect(typeof captured!.cancel).toBe('function');
  });

  it('mounts a document keydown listener that fires registered shortcuts', () => {
    let captured: WhichKeyEngine | null = null;
    render(
      <WhichKeyProvider>
        <Probe onCtx={(c) => (captured = c)} />
      </WhichKeyProvider>,
    );
    const handler = vi.fn();
    // ADAPTED: direct registry.register still works — engine.registry is the same ShortcutRegistry
    captured!.registry.register({
      id: 't1',
      keys: 'a',
      handler,
      description: undefined,
      enableOnInputs: false,
      priority: 0,
      enabled: true,
      level: 0,
      global: false,
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('updates popup state when a partial sequence times out', () => {
    vi.useFakeTimers();
    let captured: WhichKeyEngine | null = null;
    // ADAPTED: use useSyncExternalStore so the component re-renders when the engine emits.
    // The old context held React state so components re-rendered automatically; the new
    // context holds a stable engine reference, so consumers must subscribe to updates.
    const Wrapper = () => {
      const ctx = useContext(WhichKeyContext);
      const snapshot = useSyncExternalStore(
        ctx ? ctx.subscribe : () => () => {},
        ctx
          ? ctx.getSnapshot
          : () => ({
              popup: { visible: false, currentSequence: [], candidates: [] },
              cheatsheet: { visible: false },
            }),
      );
      return (
        <>
          <Probe onCtx={(c) => (captured = c)} />
          <span data-testid="vis">{snapshot.popup.visible ? 'v' : 'h'}</span>
        </>
      );
    };
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={300}>
        <Wrapper />
      </WhichKeyProvider>,
    );
    captured!.registry.register({
      id: 'gn',
      keys: 'g n',
      handler: () => {},
      description: 'Notes',
      enableOnInputs: false,
      priority: 0,
      enabled: true,
      level: 0,
      global: false,
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    expect(getByTestId('vis').textContent).toBe('h');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(getByTestId('vis').textContent).toBe('v');
  });

  it('removes the listener on unmount', () => {
    const handler = vi.fn();
    let captured: WhichKeyEngine | null = null;
    const { unmount } = render(
      <WhichKeyProvider>
        <Probe onCtx={(c) => (captured = c)} />
      </WhichKeyProvider>,
    );
    captured!.registry.register({
      id: 'x',
      keys: 'a',
      handler,
      description: undefined,
      enableOnInputs: false,
      priority: 0,
      enabled: true,
      level: 0,
      global: false,
    });
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('starts the engine on mount and stops it on unmount', () => {
    const fn = vi.fn();
    const P = () => {
      useShortcut('x', fn);
      return null;
    };
    const { unmount } = render(
      <WhichKeyProvider>
        <P />
      </WhichKeyProvider>,
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('WhichKeyProvider — cheatsheet', () => {
  it('exposes cheatsheetVisible=false initially with open/close functions', () => {
    let captured: WhichKeyEngine | null = null;
    render(
      <WhichKeyProvider>
        <Probe onCtx={(c) => (captured = c)} />
      </WhichKeyProvider>,
    );
    // ADAPTED: engine.getSnapshot().cheatsheet.visible replaces ctx.cheatsheetVisible
    expect(captured!.getSnapshot().cheatsheet.visible).toBe(false);
    expect(typeof captured!.openCheatsheet).toBe('function');
    expect(typeof captured!.closeCheatsheet).toBe('function');
  });

  it('default ? shortcut opens the cheatsheet', () => {
    let captured: WhichKeyEngine | null = null;
    // ADAPTED: use useSyncExternalStore for reactive cheatsheet visibility
    const Wrapper = () => {
      const ctx = useContext(WhichKeyContext);
      const snapshot = useSyncExternalStore(
        ctx ? ctx.subscribe : () => () => {},
        ctx
          ? ctx.getSnapshot
          : () => ({
              popup: { visible: false, currentSequence: [], candidates: [] },
              cheatsheet: { visible: false },
            }),
      );
      return (
        <>
          <Probe onCtx={(c) => (captured = c)} />
          <span data-testid="cs">{snapshot.cheatsheet.visible ? 'on' : 'off'}</span>
        </>
      );
    };
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Wrapper />
      </WhichKeyProvider>,
    );
    expect(getByTestId('cs').textContent).toBe('off');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(getByTestId('cs').textContent).toBe('on');
    act(() => {
      captured!.closeCheatsheet();
    });
    expect(getByTestId('cs').textContent).toBe('off');
  });

  it('default ? shortcut toggles the cheatsheet (open then close)', () => {
    // ADAPTED: use useSyncExternalStore for reactive cheatsheet visibility
    const Wrapper = () => {
      const ctx = useContext(WhichKeyContext);
      const snapshot = useSyncExternalStore(
        ctx ? ctx.subscribe : () => () => {},
        ctx
          ? ctx.getSnapshot
          : () => ({
              popup: { visible: false, currentSequence: [], candidates: [] },
              cheatsheet: { visible: false },
            }),
      );
      return <span data-testid="cs">{snapshot.cheatsheet.visible ? 'on' : 'off'}</span>;
    };
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Wrapper />
      </WhichKeyProvider>,
    );
    expect(getByTestId('cs').textContent).toBe('off');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(getByTestId('cs').textContent).toBe('on');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(getByTestId('cs').textContent).toBe('off');
  });

  it('helpKey=null disables the default cheatsheet shortcut', () => {
    const Wrapper = () => {
      const ctx = useContext(WhichKeyContext);
      const snapshot = useSyncExternalStore(
        ctx ? ctx.subscribe : () => () => {},
        ctx
          ? ctx.getSnapshot
          : () => ({
              popup: { visible: false, currentSequence: [], candidates: [] },
              cheatsheet: { visible: false },
            }),
      );
      return <span data-testid="cs">{snapshot.cheatsheet.visible ? 'on' : 'off'}</span>;
    };
    const { getByTestId } = render(
      <WhichKeyProvider helpKey={null}>
        <Wrapper />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(getByTestId('cs').textContent).toBe('off');
  });

  it('consumer-registered ? shortcut overrides the default (no cheatsheet open)', () => {
    let captured: WhichKeyEngine | null = null;
    const handler = vi.fn();
    const Wrapper = () => {
      const ctx = useContext(WhichKeyContext);
      const snapshot = useSyncExternalStore(
        ctx ? ctx.subscribe : () => () => {},
        ctx
          ? ctx.getSnapshot
          : () => ({
              popup: { visible: false, currentSequence: [], candidates: [] },
              cheatsheet: { visible: false },
            }),
      );
      return (
        <>
          <Probe onCtx={(c) => (captured = c)} />
          <span data-testid="cs">{snapshot.cheatsheet.visible ? 'on' : 'off'}</span>
        </>
      );
    };
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Wrapper />
      </WhichKeyProvider>,
    );
    captured!.registry.register({
      id: 'consumer',
      keys: '?',
      handler,
      description: 'My help',
      enableOnInputs: false,
      priority: 0,
      enabled: true,
      level: 0,
      global: false,
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(handler).toHaveBeenCalledOnce();
    expect(getByTestId('cs').textContent).toBe('off');
  });
});

describe('WhichKeyProvider — invalid helpKey [B23]', () => {
  // Deviation from the task brief: the brief's illustrative value ('ctrl/')
  // has no '+' in it, so parseKey treats the whole string as a single
  // (unusual but valid) base key rather than "ctrl" + "/" — it does not
  // throw, pre- or post-fix. 'Hyper+/' is the invalid-modifier fixture
  // already used for this purpose in useShortcut.test.tsx's B14 test, and it
  // genuinely throws out of createWhichKey pre-fix, which is what this test
  // needs to demonstrate.
  it('does not throw during render for an invalid helpKey', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let result: ReturnType<typeof render> | undefined;
    expect(() => {
      result = render(
        <WhichKeyProvider helpKey="Hyper+/">
          <div data-testid="alive">ok</div>
        </WhichKeyProvider>,
      );
    }).not.toThrow();
    expect(result!.getByTestId('alive')).toBeInTheDocument();
    // Confirm the render succeeded VIA the soft-fail path (the warn actually
    // fired), not via some unrelated swallow of the assertion above.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
