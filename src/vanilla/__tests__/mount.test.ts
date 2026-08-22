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

  it('Tab-cycles focus among focusable descendants, wrapping at both ends', () => {
    const wk = createWhichKey();
    wk.register('q', vi.fn(), { description: 'Quit' });
    const ui = mountWhichKey(wk);
    wk.start();
    press('?');

    const panel = document.querySelector('.wk-cheatsheet') as HTMLElement;
    const close = panel.querySelector('.wk-cheatsheet__close') as HTMLButtonElement;

    // The panel ships exactly one focusable descendant (the close button).
    // Append a second so forward/backward wrap is exercised on a genuine
    // two-item cycle instead of trivially re-focusing the same element.
    const second = document.createElement('button');
    second.type = 'button';
    second.textContent = 'second';
    panel.appendChild(second);

    // Forward Tab from the last item (second) wraps to the first (close).
    second.focus();
    expect(document.activeElement).toBe(second);
    press('Tab');
    expect(document.activeElement).toBe(close);

    // Shift+Tab from the first item (close) wraps to the last (second).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(second);

    // Shift+Tab while focus sits on the panel itself also wraps to the last —
    // this is the case the `active === panel` branch exists to cover.
    panel.focus();
    expect(document.activeElement).toBe(panel);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(second);

    ui.unmount();
    wk.stop();
  });

  it('unmount() while the cheatsheet is open removes it and restores focus', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const wk = createWhichKey();
    wk.register('q', vi.fn(), { description: 'Quit' });
    const ui = mountWhichKey(wk);
    wk.start();
    press('?');

    expect(document.querySelector('.wk-cheatsheet')).not.toBeNull();
    expect(document.activeElement).not.toBe(trigger);

    ui.unmount();

    expect(document.querySelector('.wk-cheatsheet')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    wk.stop();
    trigger.remove();
  });

  it('renders the popup as a polite live region in the vanilla renderer', () => {
    const wk = createWhichKey();
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk);
    wk.start();
    press('g');
    vi.advanceTimersByTime(500);
    const popup = document.querySelector('.wk-popup') as HTMLElement;
    expect(popup.getAttribute('role')).toBe('status');
    expect(popup.getAttribute('aria-live')).toBe('polite');
    expect(popup.getAttribute('aria-atomic')).toBe('true');
    ui.unmount();
    wk.stop();
  });

  it('vanilla popup falls back to defaults for non-finite options [B29]', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk, {
      popup: { layout: 'horizontal', maxRows: NaN, backgroundOpacity: NaN },
    });
    wk.start();
    press('g');
    vi.advanceTimersByTime(500);

    const popup = document.querySelector('.wk-popup') as HTMLElement;
    expect(popup.style.backgroundColor).toBe('rgba(17, 24, 39, 0.95)');
    expect(popup.getAttribute('style')).not.toContain('NaN');
    const grid = document.querySelector('.wk-popup__grid') as HTMLElement;
    expect(grid.style.gridTemplateRows).toBe('repeat(5, auto)');

    ui.unmount();
    wk.stop();
  });
});

describe('mountWhichKey — stable popup host [B18]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('keeps the popup below the cheatsheet backdrop in DOM order', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk);
    wk.start();

    press('?');                                   // open the cheatsheet
    press('g');                                   // then start a sequence
    vi.advanceTimersByTime(500);

    const popup = document.querySelector('.wk-popup')!;
    const backdrop = document.querySelector('.wk-backdrop')!;
    expect(popup).not.toBeNull();
    expect(backdrop).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING === 4: backdrop comes AFTER the popup,
    // so with equal z-index the backdrop paints on top, matching React.
    expect(popup.compareDocumentPosition(backdrop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    ui.unmount();
    wk.stop();
  });

  // Tightened from the brief: comparing `.wk-popup`'s `.parentElement` across
  // renders is a weak check whenever that parent happens to be `container`
  // both times (which it is, pre-fix, since the popup is always appended
  // straight into `container`) — it would pass for the wrong reason. Assert
  // instead that a `.wk-popup-host` element exists and that the very same
  // instance persists across two separate popup appearances.
  it('reuses the same host element across separate popup appearances', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    wk.register('g b', vi.fn(), { description: 'Bravo' });
    const ui = mountWhichKey(wk);
    wk.start();

    press('g');
    vi.advanceTimersByTime(500);
    const hostFirst = document.querySelector('.wk-popup-host');
    expect(hostFirst).not.toBeNull();
    expect(document.querySelector('.wk-popup')!.parentElement).toBe(hostFirst);

    wk.cancel();
    press('g');
    vi.advanceTimersByTime(500);
    const hostSecond = document.querySelector('.wk-popup-host');

    expect(hostSecond).toBe(hostFirst);

    ui.unmount();
    wk.stop();
  });

  it('unmount removes the host from the container', () => {
    const wk = createWhichKey();
    const ui = mountWhichKey(wk);
    wk.start();
    ui.unmount();
    expect(document.querySelector('.wk-popup-host')).toBeNull();
    wk.stop();
  });
});

describe('mountWhichKey — double-mount guard [B32]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('warns and renders only one popup host for a repeated mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    wk.register('g a', vi.fn(), { description: 'Alpha' });

    const first = mountWhichKey(wk);
    const second = mountWhichKey(wk);
    wk.start();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] mountWhichKey called twice'));
    press('g');
    vi.advanceTimersByTime(500);
    expect(document.querySelectorAll('[data-testid="whichkey-popup"]')).toHaveLength(1);

    second.unmount();   // the no-op handle must not tear down the live mount
    // Reset the pending 'g' buffer before pressing '?'. Per the matcher
    // (src/engine/matcher.ts, final branch — also documented at the
    // ReactFixture comment in class-contract.test.tsx), an unrelated
    // keystroke while a prefix is buffered doesn't fall back to a top-level
    // match; it's treated as "nothing matches" and aborts the sequence. The
    // brief's original test pressed '?' straight after 'g' timed out and so
    // never actually exercised the cheatsheet open — corrected here.
    wk.cancel();
    press('?');
    expect(document.querySelector('.wk-cheatsheet')).not.toBeNull();

    first.unmount();
    wk.stop();
    warn.mockRestore();
  });

  it('allows a fresh mount after the first one unmounts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    const first = mountWhichKey(wk);
    first.unmount();
    warn.mockClear();

    const second = mountWhichKey(wk);
    expect(warn).not.toHaveBeenCalled();
    second.unmount();
    wk.stop();
    warn.mockRestore();
  });

  it('unmount is idempotent', () => {
    const wk = createWhichKey();
    const ui = mountWhichKey(wk);
    ui.unmount();
    expect(() => ui.unmount()).not.toThrow();
    wk.stop();
  });
});
