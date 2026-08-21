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

  it('classPrefix option applies custom prefix classes and omits default wk- classes', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk, { classPrefix: 'kbd', popup: { layout: 'horizontal' } });
    wk.start();
    press('g');
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.kbd-popup')).not.toBeNull();
    expect(document.querySelector('.wk-popup')).toBeNull();
    ui.unmount();
    wk.stop();
  });

  it('popup: false suppresses popup node even when engine has popup visible', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk, { popup: false });
    wk.start();
    press('g');
    vi.advanceTimersByTime(500);
    expect(wk.getSnapshot().popup.visible).toBe(true);
    expect(document.querySelector('.wk-popup')).toBeNull();
    ui.unmount();
    wk.stop();
  });

  it('vertical layout emits list structure and omits horizontal-only elements', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk, { popup: { layout: 'vertical' } });
    wk.start();
    press('g');
    vi.advanceTimersByTime(500);
    expect(document.querySelector('.wk-popup--vertical')).not.toBeNull();
    expect(document.querySelector('.wk-popup__list')).not.toBeNull();
    expect(document.querySelector('.wk-popup__grid')).toBeNull();
    expect(document.querySelector('.wk-popup__body')).toBeNull();
    ui.unmount();
    wk.stop();
  });

  it('gives the cheatsheet panel modal semantics, focus, and a close button', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const wk = createWhichKey();
    wk.register('q', vi.fn(), { description: 'Quit' });
    const ui = mountWhichKey(wk);
    wk.start();
    press('?');

    const panel = document.querySelector('.wk-cheatsheet') as HTMLElement;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe('wk-cheatsheet-title');
    expect(panel.contains(document.activeElement)).toBe(true);

    const close = panel.querySelector('.wk-cheatsheet__close') as HTMLButtonElement;
    expect(close).not.toBeNull();
    close.click();
    expect(wk.getSnapshot().cheatsheet.visible).toBe(false);
    expect(document.activeElement).toBe(trigger);

    ui.unmount();
    wk.stop();
    trigger.remove();
  });
});
