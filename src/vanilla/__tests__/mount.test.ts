import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWhichKey } from '../../engine';
import { mountWhichKey } from '../mount';

const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));

describe('mountWhichKey', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('renders no popup until a prefix is pending, then renders candidate rows', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk, { popup: { layout: 'horizontal' } });
    wk.start();
    expect(document.querySelector('.wk-popup')).toBeNull();
    press('g');
    vi.advanceTimersByTime(500);
    const popup = document.querySelector('.wk-popup');
    expect(popup).not.toBeNull();
    expect(popup!.querySelectorAll('.wk-row').length).toBe(1);
    ui.unmount();
    wk.stop();
  });

  it('renders the cheatsheet on toggle and closes on backdrop click', () => {
    const wk = createWhichKey();
    wk.register('q', vi.fn(), { description: 'Quit' });
    const ui = mountWhichKey(wk);
    wk.start();
    expect(document.querySelector('.wk-cheatsheet')).toBeNull();
    press('?');
    const backdrop = document.querySelector('.wk-backdrop') as HTMLElement;
    expect(backdrop).not.toBeNull();
    expect(document.querySelector('.wk-cheatsheet')).not.toBeNull();
    backdrop.click();
    expect(wk.getSnapshot().cheatsheet.visible).toBe(false);
    ui.unmount();
    wk.stop();
  });

  it('unmount removes nodes and unsubscribes', () => {
    const wk = createWhichKey();
    const ui = mountWhichKey(wk);
    wk.start();
    ui.unmount();
    press('?');
    expect(document.querySelector('.wk-backdrop')).toBeNull();
    wk.stop();
  });
});
