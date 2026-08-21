import { describe, it, expect, vi } from 'vitest';
import {
  eventToCanonical,
  parseKey,
  parseSequence,
  isInputTarget,
  isModifierOnlyEvent,
} from '../keys';

const ev = (init: KeyboardEventInit & { key: string }) => new KeyboardEvent('keydown', init);

describe('eventToCanonical', () => {
  it('lowercases bare letter keys', () => {
    expect(eventToCanonical(ev({ key: 'a' }))).toBe('a');
  });

  it('uppercases letter when Shift is held without other modifiers', () => {
    expect(eventToCanonical(ev({ key: 'A', shiftKey: true }))).toBe('A');
  });

  it('keeps modifier+letter case canonical: Ctrl+Shift+a → Ctrl+Shift+A', () => {
    expect(eventToCanonical(ev({ key: 'A', ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+A');
  });

  it('emits Ctrl+K for Ctrl held with k (force-uppercase under any modifier)', () => {
    expect(eventToCanonical(ev({ key: 'k', ctrlKey: true }))).toBe('Ctrl+K');
  });

  it('emits Cmd+K for Meta held with k', () => {
    expect(eventToCanonical(ev({ key: 'k', metaKey: true }))).toBe('Cmd+K');
  });

  it('orders modifiers Ctrl, Alt, Shift, Cmd', () => {
    expect(
      eventToCanonical(
        ev({ key: 'p', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true }),
      ),
    ).toBe('Ctrl+Alt+Shift+Cmd+P');
  });

  it('drops Shift modifier from non-letter, non-special bases (Shift+? → ?)', () => {
    expect(eventToCanonical(ev({ key: '?', shiftKey: true }))).toBe('?');
    expect(eventToCanonical(ev({ key: '!', shiftKey: true }))).toBe('!');
  });

  it('keeps Shift modifier on special keys (Shift+Tab)', () => {
    expect(eventToCanonical(ev({ key: 'Tab', shiftKey: true }))).toBe('Shift+Tab');
  });

  it('keeps Shift modifier on function keys (Shift+F11)', () => {
    expect(eventToCanonical(ev({ key: 'F11', shiftKey: true }))).toBe('Shift+F11');
  });

  it('treats F1 as a special key (no modifier strip)', () => {
    expect(eventToCanonical(ev({ key: 'F1', shiftKey: true }))).toBe('Shift+F1');
  });

  it('recognizes Escape', () => {
    expect(eventToCanonical(ev({ key: 'Escape' }))).toBe('Escape');
  });

  it('recognizes Space', () => {
    expect(eventToCanonical(ev({ key: ' ' }))).toBe('Space');
  });

  it('recognizes ArrowUp', () => {
    expect(eventToCanonical(ev({ key: 'ArrowUp' }))).toBe('ArrowUp');
  });

  it('returns punctuation as-is', () => {
    expect(eventToCanonical(ev({ key: '/' }))).toBe('/');
    expect(eventToCanonical(ev({ key: '?' }))).toBe('?');
  });

  it('returns digits as-is', () => {
    expect(eventToCanonical(ev({ key: '5' }))).toBe('5');
  });
});

describe('isModifierOnlyEvent', () => {
  it('is true when key is Shift', () => {
    expect(isModifierOnlyEvent(ev({ key: 'Shift', shiftKey: true }))).toBe(true);
  });
  it('is true when key is Control', () => {
    expect(isModifierOnlyEvent(ev({ key: 'Control', ctrlKey: true }))).toBe(true);
  });
  it('is true when key is Alt', () => {
    expect(isModifierOnlyEvent(ev({ key: 'Alt', altKey: true }))).toBe(true);
  });
  it('is true when key is Meta', () => {
    expect(isModifierOnlyEvent(ev({ key: 'Meta', metaKey: true }))).toBe(true);
  });
  it('is false for a normal key', () => {
    expect(isModifierOnlyEvent(ev({ key: 'a' }))).toBe(false);
  });
});

describe('parseKey', () => {
  it('returns plain letter unchanged', () => {
    expect(parseKey('a')).toBe('a');
  });

  it('canonicalizes Ctrl+K (force-uppercase letter under modifier)', () => {
    expect(parseKey('Ctrl+K')).toBe('Ctrl+K');
    expect(parseKey('Ctrl+k')).toBe('Ctrl+K');
  });

  it('reorders modifiers to canonical order', () => {
    expect(parseKey('Shift+Ctrl+P')).toBe('Ctrl+Shift+P');
  });

  it('uppercases letter when Shift is the only modifier (no Shift+ in output)', () => {
    expect(parseKey('Shift+a')).toBe('A');
  });

  it('drops Shift+ from non-letter, non-special bases', () => {
    expect(parseKey('Shift+?')).toBe('?');
  });

  it('keeps Shift+ on special keys', () => {
    expect(parseKey('Shift+Tab')).toBe('Shift+Tab');
  });

  it('parses Shift+F1 to canonical Shift+F1', () => {
    expect(parseKey('Shift+F1')).toBe('Shift+F1');
  });

  it('infers Shift from a bare uppercase letter so it matches runtime canonical', () => {
    // Pressing Shift+n produces eventToCanonical → 'N'. parseKey('N') must also
    // return 'N' so that useShortcut('g N', ...) matches.
    expect(parseKey('N')).toBe('N');
    expect(parseKey('A')).toBe('A');
  });

  it('does not double-shift when Ctrl+UpperLetter is written', () => {
    // 'Ctrl+A' should mean Ctrl held with the A key, not Ctrl+Shift+A.
    expect(parseKey('Ctrl+A')).toBe('Ctrl+A');
  });

  it('treats Mod+K as Ctrl+K on non-Mac', () => {
    const orig = navigator.platform;
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
    expect(parseKey('Mod+K')).toBe('Ctrl+K');
    Object.defineProperty(navigator, 'platform', { value: orig, configurable: true });
  });

  it('treats Mod+K as Cmd+K on Mac', () => {
    const orig = navigator.platform;
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    expect(parseKey('Mod+K')).toBe('Cmd+K');
    Object.defineProperty(navigator, 'platform', { value: orig, configurable: true });
  });

  it('throws on unknown modifier', () => {
    expect(() => parseKey('Hyper+K')).toThrow(/unknown modifier/i);
  });

  it('throws on empty input', () => {
    expect(() => parseKey('')).toThrow(/empty/i);
  });

  it('throws on trailing + (missing base key)', () => {
    expect(() => parseKey('Ctrl+')).toThrow(/missing key/i);
  });

  it('throws on bare modifier name (Ctrl alone)', () => {
    expect(() => parseKey('Ctrl')).toThrow(/missing key/i);
  });

  it('throws on bare Shift', () => {
    expect(() => parseKey('Shift')).toThrow(/missing key/i);
  });
});

describe('Shift on punctuation and digits', () => {
  it('warns that Shift is dropped and names the key it will actually match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseKey('Shift+/');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Shift+/');
    expect(warn.mock.calls[0][0]).toContain('"/"');
    warn.mockRestore();
  });

  it('does not warn when the shifted character is written directly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseKey('?');
    parseKey('Shift+?');
    parseKey('Ctrl+s');
    parseKey('Shift+A');
    parseKey('Shift+Tab');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('round-trips the documented spelling against a real Shift+/ keypress', () => {
    const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    expect(parseKey('?')).toBe(eventToCanonical(event));
  });
});

describe('parseSequence', () => {
  it('splits on single spaces', () => {
    expect(parseSequence('g n')).toEqual(['g', 'n']);
  });

  it('handles multi-key with modifier in one slot', () => {
    expect(parseSequence('g Ctrl+K')).toEqual(['g', 'Ctrl+K']);
  });

  it('returns single-element array for one key', () => {
    expect(parseSequence('Escape')).toEqual(['Escape']);
  });

  it('throws on empty input', () => {
    expect(() => parseSequence('')).toThrow(/empty/i);
  });

  it('canonicalizes each segment', () => {
    expect(parseSequence('Shift+Ctrl+P g')).toEqual(['Ctrl+Shift+P', 'g']);
  });
});

describe('isInputTarget', () => {
  it('is true for an <input>', () => {
    const el = document.createElement('input');
    expect(isInputTarget(el)).toBe(true);
  });

  it('is true for a <textarea>', () => {
    const el = document.createElement('textarea');
    expect(isInputTarget(el)).toBe(true);
  });

  it('is true for contenteditable element', () => {
    const el = document.createElement('div');
    el.setAttribute('contenteditable', 'true');
    document.body.appendChild(el);
    expect(isInputTarget(el)).toBe(true);
    el.remove();
  });

  it('is false for a <button>', () => {
    expect(isInputTarget(document.createElement('button'))).toBe(false);
  });

  it('is false for a plain <div>', () => {
    expect(isInputTarget(document.createElement('div'))).toBe(false);
  });

  it('is false for null target', () => {
    expect(isInputTarget(null)).toBe(false);
  });
});

describe('modifier case-insensitivity', () => {
  it('accepts every documented modifier in any case', () => {
    expect(parseKey('ctrl+s')).toBe('Ctrl+S');
    expect(parseKey('CTRL+s')).toBe('Ctrl+S');
    expect(parseKey('Ctrl+s')).toBe('Ctrl+S');
    expect(parseKey('alt+x')).toBe('Alt+X');
    expect(parseKey('shift+Tab')).toBe('Shift+Tab');
    expect(parseKey('cmd+k')).toBe('Cmd+K');
  });

  it('accepts the common spelled-out aliases', () => {
    expect(parseKey('control+s')).toBe('Ctrl+S');
    expect(parseKey('option+x')).toBe('Alt+X');
    expect(parseKey('meta+k')).toBe('Cmd+K');
    expect(parseKey('command+k')).toBe('Cmd+K');
  });

  it('round-trips a lowercase modifier against a real keypress', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(parseKey('ctrl+s')).toBe(eventToCanonical(event));
  });

  it('still rejects a genuinely unknown modifier', () => {
    expect(() => parseKey('Hyper+K')).toThrow(/unknown modifier/);
    expect(() => parseKey('hyper+K')).toThrow(/unknown modifier/);
  });

  it('still rejects a bare modifier with no key', () => {
    expect(() => parseKey('ctrl+')).toThrow();
    expect(() => parseKey('ctrl')).toThrow();
  });
});
