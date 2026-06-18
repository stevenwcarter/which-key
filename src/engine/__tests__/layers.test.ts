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
