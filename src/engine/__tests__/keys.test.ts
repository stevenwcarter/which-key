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
  it('is true when key is AltGraph (AltGr must not cancel a pending sequence)', () => {
    // A German/Nordic/Latin-American layout reports AltGr as ctrlKey+altKey with
    // event.key === 'AltGraph'. Treated as a normal key it canonicalizes to
    // 'Ctrl+Alt+AltGraph', matches nothing, and resets the pending buffer.
    expect(isModifierOnlyEvent(ev({ key: 'AltGraph', ctrlKey: true, altKey: true }))).toBe(true);
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

describe('parseKey — special-key aliases [B15]', () => {
  // The bar is a ROUND TRIP: what parseKey produces for the alias must equal
  // what eventToCanonical produces for the real key press.
  const cases: Array<[string, KeyboardEventInit]> = [
    ['escape', { key: 'Escape' }],
    ['esc', { key: 'Escape' }],
    ['ESC', { key: 'Escape' }],
    ['tab', { key: 'Tab' }],
    ['enter', { key: 'Enter' }],
    ['backspace', { key: 'Backspace' }],
    ['space', { key: ' ' }],
    ['up', { key: 'ArrowUp' }],
    ['down', { key: 'ArrowDown' }],
    ['left', { key: 'ArrowLeft' }],
    ['right', { key: 'ArrowRight' }],
    ['home', { key: 'Home' }],
    ['end', { key: 'End' }],
    ['pgup', { key: 'PageUp' }],
    ['pagedown', { key: 'PageDown' }],
    ['f1', { key: 'F1' }],
    ['F12', { key: 'F12' }],
  ];

  it.each(cases)('parseKey(%p) round-trips against the real event', (alias, init) => {
    expect(parseKey(alias)).toBe(eventToCanonical(new KeyboardEvent('keydown', init)));
  });

  it('applies aliases under modifiers too', () => {
    expect(parseKey('ctrl+esc')).toBe(
      eventToCanonical(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true })),
    );
  });

  it('warns for a multi-character base no browser reports, without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => parseKey('Blorp')).not.toThrow();
    expect(parseKey('Blorp')).toBe('Blorp');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('will never match'));
    warn.mockRestore();
  });

  it('round-trips an exotic event.key it cannot validate, and warns — it cannot tell a real key from a typo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseKey('MediaPlayPause')).toBe(
      eventToCanonical(new KeyboardEvent('keydown', { key: 'MediaPlayPause' })),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn or alter single-character bases', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseKey('a')).toBe('a');
    expect(parseKey('/')).toBe('/');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('parseKey — recognised-but-previously-unlisted bases do not warn [B48]', () => {
  // Pre-fix, every one of these canonicalized correctly and would match a
  // real event, but normalizeBase warned anyway because SPECIAL_KEYS (an
  // internal buildCanonical concern) was being read as "the key inventory".
  // Load-bearing: each assertion fails against the pre-fix code, which
  // warned for every exact-cased name here and had no lowercase alias.
  const cases: Array<[string, KeyboardEventInit]> = [
    ['Delete', { key: 'Delete' }],
    ['Insert', { key: 'Insert' }],
    ['CapsLock', { key: 'CapsLock' }],
    ['ContextMenu', { key: 'ContextMenu' }],
    ['PrintScreen', { key: 'PrintScreen' }],
    ['ScrollLock', { key: 'ScrollLock' }],
    ['Pause', { key: 'Pause' }],
    ['NumLock', { key: 'NumLock' }],
    ['Clear', { key: 'Clear' }],
    ['Help', { key: 'Help' }],
    ['F13', { key: 'F13' }],
    // Lowercase spellings: closes the converse hole where register('delete')
    // etc. was still silently dead (no alias mapped it onto 'Delete').
    ['delete', { key: 'Delete' }],
    ['insert', { key: 'Insert' }],
    ['capslock', { key: 'CapsLock' }],
    ['contextmenu', { key: 'ContextMenu' }],
    ['printscreen', { key: 'PrintScreen' }],
    ['scrolllock', { key: 'ScrollLock' }],
    ['pause', { key: 'Pause' }],
    ['numlock', { key: 'NumLock' }],
    ['clear', { key: 'Clear' }],
    ['help', { key: 'Help' }],
  ];

  it.each(cases)(
    'parseKey(%p) round-trips against the real event and does not warn',
    (alias, init) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(parseKey(alias)).toBe(eventToCanonical(new KeyboardEvent('keydown', init)));
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    },
  );

  it('does not warn for F14-F24', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const n of [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]) {
      expect(parseKey(`F${n}`)).toBe(
        eventToCanonical(new KeyboardEvent('keydown', { key: `F${n}` })),
      );
    }
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applies Delete under a modifier too (Mod+Delete)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const orig = navigator.platform;
    Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64', configurable: true });
    expect(parseKey('Mod+Delete')).toBe(
      eventToCanonical(new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true })),
    );
    Object.defineProperty(navigator, 'platform', { value: orig, configurable: true });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('a genuinely unknown base still warns (does not over-widen the fix)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseKey('Blorp')).toBe('Blorp');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('will never match'));
    warn.mockRestore();
  });
});

describe('isMacPlatform — absent navigator [B31]', () => {
  it('resolves Mod to Ctrl instead of throwing when navigator is undefined', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    // Simulate a Node 20 SSR/prerender runtime with no navigator global.
    Reflect.deleteProperty(globalThis, 'navigator');
    try {
      expect(() => parseKey('Mod+/')).not.toThrow();
      expect(parseKey('Mod+/')).toBe(parseKey('Ctrl+/'));
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
    }
  });

  it('prefers userAgentData.platform when present', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgentData: { platform: 'macOS' }, platform: 'Linux x86_64' },
      configurable: true,
    });
    try {
      expect(parseKey('Mod+/')).toBe(parseKey('Cmd+/'));
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
      else Reflect.deleteProperty(globalThis, 'navigator');
    }
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

  it('rejects a modifier word in base position regardless of case', () => {
    // Pre-task, case-insensitive matching made this inconsistent: Ctrl+Shift threw,
    // but Ctrl+shift silently produced a dead binding ('Ctrl+shift' key, not fireable).
    // Now both throw. This is intentional: no alias word (ctrl, control, alt, option,
    // shift, cmd, meta, command, mod) is ever emitted by event.key, so every such
    // string was unfireable. The throw converts a silent dead binding into a loud error.
    // Regression pins: Ctrl+Shift was already throwing pre-task (not widening, finishing
    // the generalization). Genuinely new: Ctrl+shift, Mod+alt, Alt+cmd now throw instead
    // of parsing as dead literal keys.
    expect(() => parseKey('Ctrl+Shift')).toThrow(/missing key after modifier/);
    expect(() => parseKey('Ctrl+shift')).toThrow(/missing key after modifier/);
    expect(() => parseKey('Mod+Alt')).toThrow(/missing key after modifier/);
    expect(() => parseKey('Mod+alt')).toThrow(/missing key after modifier/);
    expect(() => parseKey('Alt+Cmd')).toThrow(/missing key after modifier/);
    expect(() => parseKey('Alt+cmd')).toThrow(/missing key after modifier/);
  });
});

describe('canonical-key parity: parseKey ⇄ eventToCanonical [Invariant 1]', () => {
  // The load-bearing test for this milestone. parseKey and eventToCanonical are
  // only ever joined through buildCanonical, and registry lookups are plain Map
  // gets — so a signature change at that join point that transposes two flags
  // type-checks silently and leaves BOTH directions' own unit tests green while
  // every real binding stops matching. This asserts the pairing itself.
  const chords: Array<[string, KeyboardEventInit & { key: string }]> = [
    ['a', { key: 'a' }],
    ['A', { key: 'A', shiftKey: true }],
    ['Ctrl+k', { key: 'k', ctrlKey: true }],
    ['Ctrl+Shift+p', { key: 'P', ctrlKey: true, shiftKey: true }],
    ['Alt+x', { key: 'x', altKey: true }],
    ['Cmd+k', { key: 'k', metaKey: true }],
    [
      'Ctrl+Alt+Shift+Cmd+p',
      { key: 'P', ctrlKey: true, altKey: true, shiftKey: true, metaKey: true },
    ],
    ['Shift+Tab', { key: 'Tab', shiftKey: true }],
    ['Shift+F1', { key: 'F1', shiftKey: true }],
    ['F12', { key: 'F12' }],
    ['Ctrl+Escape', { key: 'Escape', ctrlKey: true }],
    ['space', { key: ' ' }],
    ['Ctrl+space', { key: ' ', ctrlKey: true }],
    ['Shift+space', { key: ' ', shiftKey: true }],
    ['Alt+ArrowUp', { key: 'ArrowUp', altKey: true }],
    ['Ctrl+Shift+ArrowLeft', { key: 'ArrowLeft', ctrlKey: true, shiftKey: true }],
    ['?', { key: '?', shiftKey: true }],
    ['/', { key: '/' }],
    ['5', { key: '5' }],
    ['Ctrl+pgdn', { key: 'PageDown', ctrlKey: true }],
  ];

  it.each(chords)('parseKey(%p) === eventToCanonical of the matching keypress', (spec, init) => {
    expect(parseKey(spec)).toBe(eventToCanonical(ev(init)));
  });
});

describe('modifier parsing is a single pass over the leading segments [T10]', () => {
  it('names both the offending segment and the whole input when a modifier is unknown', () => {
    expect(() => parseKey('Hyper+Ctrl+K')).toThrow(
      'whichkey: unknown modifier "Hyper" in "Hyper+Ctrl+K"',
    );
  });

  it('folds every documented alias, in any case, into one canonical chord', () => {
    expect(parseKey('control+option+shift+cmd+k')).toBe('Ctrl+Alt+Shift+Cmd+K');
  });
});

describe('parseKey/eventToCanonical pairing around "+" [T12 characterization]', () => {
  // Pins the splitting rule that D1 deliberately does NOT change, and the
  // runtime half that already emits '+'. All of these pass before the fix and
  // must keep passing after it.
  it('rejects a bare "+" registration string — the split leaves no base', () => {
    expect(() => parseKey('+')).toThrow(/missing key after modifier/);
  });

  it('rejects "Ctrl++" — the trailing "+" is consumed by the split, not read as a base', () => {
    expect(() => parseKey('Ctrl++')).toThrow(/missing key after modifier/);
  });

  it('canonicalizes a real "+" keypress, with or without the Shift that produced it', () => {
    expect(eventToCanonical(ev({ key: '+' }))).toBe('+');
    expect(eventToCanonical(ev({ key: '+', shiftKey: true }))).toBe('+');
    expect(eventToCanonical(ev({ key: '+', ctrlKey: true }))).toBe('Ctrl++');
  });

  it('leaves the neighbouring punctuation bases round-tripping as before', () => {
    expect(parseKey('Ctrl+-')).toBe(eventToCanonical(ev({ key: '-', ctrlKey: true })));
    expect(parseKey('Ctrl+=')).toBe(eventToCanonical(ev({ key: '=', ctrlKey: true })));
  });
});

describe('parseKey — the "Plus" alias makes "+" bindable [T12]', () => {
  it('round-trips against a real "+" keypress', () => {
    expect(parseKey('Plus')).toBe('+');
    expect(parseKey('Plus')).toBe(eventToCanonical(ev({ key: '+' })));
    // US layout: '+' is Shift+'=', and buildCanonical drops Shift for punctuation.
    expect(parseKey('Plus')).toBe(eventToCanonical(ev({ key: '+', shiftKey: true })));
  });

  it('accepts any casing, works under modifiers, and works inside a sequence', () => {
    expect(parseKey('plus')).toBe('+');
    expect(parseKey('PLUS')).toBe('+');
    expect(parseKey('Ctrl+Plus')).toBe('Ctrl++');
    expect(parseKey('Ctrl+Plus')).toBe(eventToCanonical(ev({ key: '+', ctrlKey: true })));
    expect(parseSequence('g Plus')).toEqual(['g', '+']);
  });

  it('does not warn about an unrecognised base', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseKey('Plus')).toBe('+');
    expect(parseKey('Ctrl+Plus')).toBe('Ctrl++');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still rejects the bare "+" spelling — the splitting rule is unchanged (D1)', () => {
    expect(() => parseKey('+')).toThrow(/missing key after modifier/);
    expect(() => parseKey('Ctrl++')).toThrow(/missing key after modifier/);
  });
});
