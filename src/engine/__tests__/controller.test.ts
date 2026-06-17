import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWhichKey } from '../controller';

const press = (key: string, target: EventTarget = document.body) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true });
  Object.defineProperty(ev, 'target', { value: target });
  document.dispatchEvent(ev);
};

describe('createWhichKey', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires a pure leaf handler without showing the popup', () => {
    const wk = createWhichKey();
    const fn = vi.fn();
    wk.register('x', fn);
    wk.start();
    press('x');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(wk.getSnapshot().popup.visible).toBe(false);
    wk.stop();
  });

  it('shows a popup with sorted candidates after the timeout for a prefix', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g b', vi.fn(), { description: 'Beta' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    wk.start();
    press('g');
    expect(wk.getSnapshot().popup.visible).toBe(false);
    vi.advanceTimersByTime(500);
    const snap = wk.getSnapshot();
    expect(snap.popup.visible).toBe(true);
    expect(snap.popup.candidates.map((c) => c.nextKey)).toEqual(['a', 'b']);
    wk.stop();
  });

  it('toggles the cheatsheet via the help key and notifies subscribers', () => {
    const wk = createWhichKey();
    const listener = vi.fn();
    wk.subscribe(listener);
    wk.start();
    press('?');
    expect(wk.getSnapshot().cheatsheet.visible).toBe(true);
    expect(listener).toHaveBeenCalled();
    press('?');
    expect(wk.getSnapshot().cheatsheet.visible).toBe(false);
    wk.stop();
  });

  it('helpKey: null disables the cheatsheet shortcut', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.start();
    press('?');
    expect(wk.getSnapshot().cheatsheet.visible).toBe(false);
    wk.stop();
  });

  it('start attaches and stop detaches the listener on the target', () => {
    const wk = createWhichKey();
    const fn = vi.fn();
    wk.register('x', fn);
    press('x');
    expect(fn).not.toHaveBeenCalled(); // not started yet
    wk.start();
    press('x');
    expect(fn).toHaveBeenCalledTimes(1);
    wk.stop();
    press('x');
    expect(fn).toHaveBeenCalledTimes(1); // detached
  });

  it('register/registerGroup return working unregister thunks', () => {
    const wk = createWhichKey();
    const fn = vi.fn();
    const off = wk.register('x', fn);
    wk.start();
    off();
    press('x');
    expect(fn).not.toHaveBeenCalled();
    wk.stop();
  });

  it('getSnapshot returns a referentially stable value until a change occurs', () => {
    const wk = createWhichKey();
    const a = wk.getSnapshot();
    expect(wk.getSnapshot()).toBe(a);
    wk.openCheatsheet();
    expect(wk.getSnapshot()).not.toBe(a);
  });

  it('getCheatsheetModel partitions standalone vs grouped, skipping the help entry', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    wk.register('q', vi.fn(), { description: 'Quit' });
    const model = wk.getCheatsheetModel();
    expect(model.standalone.map((e) => e.keys)).toEqual(['q']);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0].prefix).toBe('g');
    expect(model.groups[0].description).toBe('Go');
    expect(model.groups[0].entries.map((e) => e.keys)).toEqual(['g a']);
  });

  it('registerGroup returns a working unregister thunk', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    const offGroup = wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    expect(wk.getCheatsheetModel().groups[0].description).toBe('Go');
    offGroup();
    // Group metadata is gone; the entry remains but with no group description.
    expect(wk.getCheatsheetModel().groups[0].description).toBeUndefined();
  });

});
