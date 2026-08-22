import { describe, it, expect, vi } from 'vitest';
import { createWhichKey } from '../controller';

const press = (target: EventTarget, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('layers — matcher integration', () => {
  it('base shortcut does not fire while an exclusive layer is active, fires after pop', () => {
    const wk = createWhichKey({ helpKey: null, target: document });
    wk.start();
    const base = vi.fn();
    wk.register('a', base);
    const layer = wk.pushLayer({ exclusive: true });
    press(document, 'a');
    expect(base).not.toHaveBeenCalled();
    layer.pop();
    press(document, 'a');
    expect(base).toHaveBeenCalledTimes(1);
    wk.stop();
  });

  it('a global shortcut still fires under an exclusive layer', () => {
    const wk = createWhichKey({ helpKey: null, target: document });
    wk.start();
    const g = vi.fn();
    wk.register('x', g, { global: true });
    wk.pushLayer({ exclusive: true });
    press(document, 'x');
    expect(g).toHaveBeenCalledTimes(1);
    wk.stop();
  });

  it('popup candidates reflect only reachable shortcuts', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('g d', () => {}, { description: 'base' });
    const layer = wk.pushLayer({ exclusive: true });
    layer.register('g x', () => {}, { description: 'modal' });
    expect(wk.registry.getActiveCandidates('g').map((c) => c.keys)).toEqual(['g x']);
  });
});

describe('pushLayer — explicit level validation [B34]', () => {
  it.each([-1, 1.5, NaN, Infinity])('warns and falls back to nextLevel() for %p', (bad) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    const layer = wk.pushLayer({ level: bad });
    layer.register('z', vi.fn(), { description: 'Zed' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid pushLayer level'));
    expect(layer.level).toBe(1);
    expect(wk.registry.getActive('z')).toBeDefined();
    layer.pop();
    warn.mockRestore();
  });

  it('honours a valid explicit level', () => {
    const wk = createWhichKey();
    const layer = wk.pushLayer({ level: 3 });
    layer.register('z', vi.fn());
    expect(layer.level).toBe(3);
    expect(wk.registry.getActive('z')).toBeDefined();
    layer.pop();
  });

  it('warns when an explicit level undercuts the next free level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    const outer = wk.pushLayer({ exclusive: true });   // level 1
    const inner = wk.pushLayer({ exclusive: true });   // level 2
    warn.mockClear();

    // nextLevel() is now 3, so level 1 undercuts by more than one.
    const undercut = wk.pushLayer({ level: 1 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] pushLayer level 1'));
    expect(undercut.level).toBe(1);   // still honoured, just flagged

    undercut.pop(); inner.pop(); outer.pop();
    warn.mockRestore();
  });
});
