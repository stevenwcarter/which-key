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
    matcher.handleKeyDown(ev({ key: 'g' }));
    expect(onFire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onFire).toHaveBeenCalledWith(leaf, expect.any(KeyboardEvent));
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
