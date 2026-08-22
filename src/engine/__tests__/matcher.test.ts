import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Matcher } from '../matcher';
import { ShortcutRegistry } from '../registry';
import type { ShortcutEntry } from '../types';

const ev = (init: KeyboardEventInit & { key: string }, target?: EventTarget) => {
  const event = new KeyboardEvent('keydown', init);
  if (target) Object.defineProperty(event, 'target', { value: target });
  return event;
};

const entry = (overrides: Partial<ShortcutEntry>): ShortcutEntry => ({
  id: overrides.id ?? `id-${Math.random()}`,
  keys: 'g',
  handler: () => {},
  description: undefined,
  enableOnInputs: false,
  priority: 0,
  enabled: true,
  level: 0,
  global: false,
  ...overrides,
});

type FireFn = (entry: ShortcutEntry, event: KeyboardEvent) => void;
type ShowFn = (state: { currentSequence: string[] }) => void;
type HideFn = () => void;

const buildMatcher = (
  callbacks: {
    onFire?: ReturnType<typeof vi.fn<FireFn>>;
    onShowPopup?: ReturnType<typeof vi.fn<ShowFn>>;
    onHidePopup?: ReturnType<typeof vi.fn<HideFn>>;
  } = {},
  timeoutMs = 500,
) => {
  const registry = new ShortcutRegistry();
  const matcher = new Matcher(registry, {
    timeoutMs,
    onFire: callbacks.onFire ?? vi.fn<FireFn>(),
    onShowPopup: callbacks.onShowPopup ?? vi.fn<ShowFn>(),
    onHidePopup: callbacks.onHidePopup ?? vi.fn<HideFn>(),
  });
  return { registry, matcher, callbacks };
};

describe('Matcher — single-key dispatch', () => {
  it('fires handler for a registered single-key shortcut', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    const e = entry({ keys: 'a' });
    registry.register(e);
    matcher.handleKeyDown(ev({ key: 'a' }));
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire).toHaveBeenCalledWith(e, expect.any(KeyboardEvent));
  });

  it('does nothing when no shortcut is registered for the key', () => {
    const onFire = vi.fn<FireFn>();
    const { matcher } = buildMatcher({ onFire });
    matcher.handleKeyDown(ev({ key: 'q' }));
    expect(onFire).not.toHaveBeenCalled();
  });

  it('ignores modifier-only events (just Shift, just Ctrl, etc.)', () => {
    const onFire = vi.fn<FireFn>();
    const { matcher } = buildMatcher({ onFire });
    matcher.handleKeyDown(ev({ key: 'Shift', shiftKey: true }));
    matcher.handleKeyDown(ev({ key: 'Control', ctrlKey: true }));
    expect(onFire).not.toHaveBeenCalled();
  });

  it('fires modifier+letter shortcut (Ctrl+K)', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'Ctrl+K' }));
    matcher.handleKeyDown(ev({ key: 'k', ctrlKey: true }));
    expect(onFire).toHaveBeenCalledOnce();
  });
});

describe('Matcher — input guard', () => {
  it('suppresses shortcut when target is an input', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'a' }));
    const input = document.createElement('input');
    matcher.handleKeyDown(ev({ key: 'a' }, input));
    expect(onFire).not.toHaveBeenCalled();
  });

  it('fires shortcut on input target when entry has enableOnInputs: true', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'Escape', enableOnInputs: true }));
    const input = document.createElement('input');
    matcher.handleKeyDown(ev({ key: 'Escape' }, input));
    expect(onFire).toHaveBeenCalledOnce();
  });

  it('fires shortcut on plain target', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'a' }));
    matcher.handleKeyDown(ev({ key: 'a' }, document.createElement('div')));
    expect(onFire).toHaveBeenCalledOnce();
  });
});

describe('shadow DOM input guard', () => {
  it('suppresses a shortcut typed into an input inside an open shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'password';
    root.appendChild(input);

    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'd', enableOnInputs: false }));

    const event = new KeyboardEvent('keydown', { key: 'd', composed: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: host });
    Object.defineProperty(event, 'composedPath', { value: () => [input, root, host, document] });
    matcher.handleKeyDown(event);

    expect(onFire).not.toHaveBeenCalled();
    host.remove();
  });

  it('is unchanged for ordinary light-DOM targets', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'd', enableOnInputs: false }));

    const div = document.createElement('div');
    document.body.appendChild(div);
    const event = new KeyboardEvent('keydown', { key: 'd' });
    Object.defineProperty(event, 'target', { value: div });
    matcher.handleKeyDown(event);

    expect(onFire).toHaveBeenCalledTimes(1);
    div.remove();
  });
});

describe('Matcher — sequences', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire on first key of a prefix-only sequence', () => {
    const onFire = vi.fn();
    const onShowPopup = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire, onShowPopup });
    registry.register(entry({ keys: 'g n' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    expect(onFire).not.toHaveBeenCalled();
    expect(onShowPopup).not.toHaveBeenCalled();
  });

  it('shows popup after timeout for prefix-only sequence', () => {
    const onShowPopup = vi.fn();
    const { registry, matcher } = buildMatcher({ onShowPopup }, 500);
    registry.register(entry({ keys: 'g n' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(500);
    expect(onShowPopup).toHaveBeenCalledWith({ currentSequence: ['g'] });
  });

  it('fires the leaf after second key of a sequence', () => {
    const onFire = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire });
    const e = entry({ keys: 'g n' });
    registry.register(e);
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'n' }));
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire).toHaveBeenCalledWith(e, expect.any(KeyboardEvent));
  });

  it('clears buffer after firing a sequence', () => {
    const onFire = vi.fn();
    const onHidePopup = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire, onHidePopup });
    registry.register(entry({ keys: 'g n' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'n' }));
    expect(onHidePopup).toHaveBeenCalled();
    onFire.mockClear();
    matcher.handleKeyDown(ev({ key: 'g' }));
    expect(onFire).not.toHaveBeenCalled();
  });

  it('Escape cancels a partial sequence', () => {
    const onHidePopup = vi.fn();
    const { registry, matcher } = buildMatcher({ onHidePopup });
    registry.register(entry({ keys: 'g n' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'Escape' }));
    expect(onHidePopup).toHaveBeenCalled();
    // Subsequent 'n' should not fire 'g n'
    const onFire = vi.fn();
    const fresh = buildMatcher({ onFire });
    fresh.registry.register(entry({ keys: 'g n' }));
    fresh.matcher.handleKeyDown(ev({ key: 'g' }));
    fresh.matcher.handleKeyDown(ev({ key: 'Escape' }));
    fresh.matcher.handleKeyDown(ev({ key: 'n' }));
    expect(onFire).not.toHaveBeenCalled();
  });

  it('Escape captured by an explicit registered shortcut still fires', () => {
    const onFire = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire });
    const e = entry({ keys: 'Escape' });
    registry.register(e);
    matcher.handleKeyDown(ev({ key: 'Escape' }));
    expect(onFire).toHaveBeenCalledOnce();
  });

  it('Escape completes a pending compound sequence when a leaf is registered for it, instead of cancelling [B38]', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    const e = entry({ keys: 'g Escape' });
    registry.register(e);
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'Escape' }));
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire).toHaveBeenCalledWith(e, expect.any(KeyboardEvent));
  });

  it('mismatched key after a prefix clears buffer', () => {
    const onFire = vi.fn();
    const onHidePopup = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire, onHidePopup });
    registry.register(entry({ keys: 'g n' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'q' }));
    expect(onFire).not.toHaveBeenCalled();
    expect(onHidePopup).toHaveBeenCalled();
  });

  it('leaf-AND-prefix: fires the leaf after timeout when no follow-up arrives', () => {
    const onFire = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    const leaf = entry({ id: 'leaf', keys: 'g' });
    const seq = entry({ id: 'seq', keys: 'g g' });
    registry.register(leaf);
    registry.register(seq);
    const triggering = ev({ key: 'g' });
    matcher.handleKeyDown(triggering);
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onFire).toHaveBeenCalledWith(leaf, triggering);
  });

  it('leaf-AND-prefix: continues sequence when a follow-up arrives', () => {
    const onFire = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    const leaf = entry({ id: 'leaf', keys: 'g' });
    const seq = entry({ id: 'seq', keys: 'g g' });
    registry.register(leaf);
    registry.register(seq);
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire).toHaveBeenCalledWith(seq, expect.any(KeyboardEvent));
  });

  it('arriving key cancels the leaf-AND-prefix timer (no double fire)', () => {
    const onFire = vi.fn();
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    registry.register(entry({ id: 'leaf', keys: 'g' }));
    registry.register(entry({ id: 'seq', keys: 'g g' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(1000);
    expect(onFire).toHaveBeenCalledOnce();
  });
});

describe('Matcher — leaf-AND-prefix timeout event fidelity [B17]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands the handler the real triggering event, not a synthetic one', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    const leaf = entry({ id: 'leaf', keys: 'Ctrl+G' });
    registry.register(leaf);
    registry.register(entry({ id: 'deeper', keys: 'Ctrl+G h' }));

    const target = document.createElement('div');
    const triggering = ev({ key: 'g', ctrlKey: true, cancelable: true }, target);
    matcher.handleKeyDown(triggering);
    vi.advanceTimersByTime(500);

    expect(onFire).toHaveBeenCalledOnce();
    const fired = onFire.mock.calls[0][1];
    expect(fired).toBe(triggering);
    expect(fired.target).toBe(target);
    expect(fired.ctrlKey).toBe(true);
    expect(fired.cancelable).toBe(true);
  });

  it('lets the handler actually preventDefault the timed-out event', () => {
    const onFire = vi.fn<FireFn>((_e, event) => event.preventDefault());
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    registry.register(entry({ id: 'leaf', keys: 'g' }));
    registry.register(entry({ id: 'deeper', keys: 'g h' }));

    const triggering = ev({ key: 'g', cancelable: true }, document.createElement('div'));
    matcher.handleKeyDown(triggering);
    vi.advanceTimersByTime(500);

    expect(triggering.defaultPrevented).toBe(true);
  });
});

describe('Matcher — onFire exceptions do not wedge the buffer [B4, matcher half]', () => {
  // `Matcher`/`MatcherOptions` are exported public API (src/engine/index.ts).
  // createWhichKey's own `onFire` swallows every handler exception, so the
  // `finally` blocks around `this.options.onFire(...)` are unreachable through
  // the public engine — but a third-party consumer's `onFire` can still
  // throw, and the buffer must not be left dirty when it does. There is no
  // catch at the Matcher level (by design), so the throw is expected to
  // propagate out of `handleKeyDown` / the deferred timer callback; these
  // tests assert only that the *buffer* was still reset despite the throw.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pure-leaf branch: resets the buffer even though onFire throws', () => {
    const onFire = vi.fn<FireFn>().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { registry, matcher } = buildMatcher({ onFire });
    // 'g h' is a leaf with no further continuation, so firing it takes the
    // pure-leaf immediate branch. It is reached via a prefix step first so
    // there is an actual buffer (['g']) for a leaked `finally` to fail to
    // clear — a single top-level key never dirties `this.buffer` in the
    // first place, so it wouldn't discriminate a reverted `finally`.
    registry.register(entry({ id: 'gh', keys: 'g h' }));
    registry.register(entry({ id: 'z', keys: 'z' }));

    matcher.handleKeyDown(ev({ key: 'g' })); // prefix-only: commits buffer ['g']
    expect(() => matcher.handleKeyDown(ev({ key: 'h' }))).toThrow('boom');

    // If the buffer were left dirty at ['g'], this single 'z' keystroke would
    // be interpreted as the mismatched sequence 'g z' and swallowed silently
    // (no fire) rather than matching the standalone leaf 'z'.
    matcher.handleKeyDown(ev({ key: 'z' }));
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'z' }),
      expect.any(KeyboardEvent),
    );
  });

  it('leaf-AND-prefix branch: resets the buffer even though the deferred onFire throws', () => {
    const onFire = vi.fn<FireFn>().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    registry.register(entry({ id: 'leaf', keys: 'g' }));
    registry.register(entry({ id: 'seq', keys: 'g g' }));
    registry.register(entry({ id: 'z', keys: 'z' }));

    matcher.handleKeyDown(ev({ key: 'g' })); // leaf-AND-prefix: commits buffer ['g'], arms deferred-fire timer
    expect(() => vi.advanceTimersByTime(500)).toThrow('boom');

    // Same discrimination as above: a leaked buffer would turn this into the
    // mismatched sequence 'g z' and swallow it instead of firing leaf 'z'.
    matcher.handleKeyDown(ev({ key: 'z' }));
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'z' }),
      expect.any(KeyboardEvent),
    );
  });
});

describe('Matcher — popup freshness during the leaf-AND-prefix wait [B21]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refreshes the visible popup when a leaf-AND-prefix key commits', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h' }));
    registry.register(entry({ id: 'ghx', keys: 'g h x' }));
    registry.register(entry({ id: 'gp', keys: 'g p' }));

    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(50);
    expect(onShowPopup).toHaveBeenLastCalledWith({ currentSequence: ['g'] });

    onShowPopup.mockClear();
    matcher.handleKeyDown(ev({ key: 'h' }));
    expect(onShowPopup).toHaveBeenCalledOnce();
    expect(onShowPopup).toHaveBeenLastCalledWith({ currentSequence: ['g', 'h'] });
  });

  it('does not refresh when the popup is not yet visible', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h' }));
    registry.register(entry({ id: 'ghx', keys: 'g h x' }));

    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'h' }));
    expect(onShowPopup).not.toHaveBeenCalled();
  });

  it('never surfaces a buffer tainted by a character echoed into a text field', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const onHidePopup = vi.fn<HideFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup, onHidePopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h', enableOnInputs: true }));
    registry.register(entry({ id: 'ghx', keys: 'g h x', enableOnInputs: true }));
    registry.register(entry({ id: 'gp', keys: 'g p', enableOnInputs: true }));

    const input = document.createElement('input');
    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(50);
    onShowPopup.mockClear();

    // 'h' typed into a text field echoes a character — the latch must hold.
    matcher.handleKeyDown(ev({ key: 'h' }, input));
    expect(onShowPopup).not.toHaveBeenCalled();
  });
});
