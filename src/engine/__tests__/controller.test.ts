import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWhichKey } from '../controller';
import type { ShortcutHandler } from '../types';

const press = (key: string, target: EventTarget = document.body) => {
  // Dispatch on the real target (not document with a faked `.target`) so
  // `event.composedPath()[0]` — what Matcher now reads — genuinely resolves
  // to `target`, matching real browser behavior. `target` must be connected
  // to `document` (the matcher's default bound target) so the event bubbles
  // up and the listener actually sees it.
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
};

// Like `press`, but for keystrokes that need modifier flags (Ctrl/Alt/Meta) —
// used by the Finding-1 narrowed-latch tests below, which must distinguish
// character-echoing keystrokes from modifier chords that never insert text.
const pressWithInit = (init: KeyboardEventInit & { key: string }, target: EventTarget = document.body) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true }));
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

  describe('handler exceptions', () => {
    it('resets sequence state when an immediate leaf handler throws', () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wk = createWhichKey();
      const ok = vi.fn();
      wk.register('x', () => { throw new Error('boom'); }, { description: 'Boom' });
      wk.register('y', ok, { description: 'Fine' });
      wk.start();

      expect(() => press('x')).not.toThrow();
      press('y');

      expect(ok).toHaveBeenCalledTimes(1);
      expect(wk.getSnapshot().popup.visible).toBe(false);
      expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
      expect(err).toHaveBeenCalled();
      expect(String(err.mock.calls[0][0])).toContain('[whichkey]');
      wk.stop();
      err.mockRestore();
    });

    it('resets sequence state when a deferred leaf-and-prefix handler throws', () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wk = createWhichKey({ timeoutMs: 50 });
      const ok = vi.fn();
      wk.register('g', () => { throw new Error('boom'); }, { description: 'Leaf' });
      wk.register('g h', vi.fn(), { description: 'Deeper' });
      wk.register('y', ok, { description: 'Fine' });
      wk.start();

      press('g');
      expect(() => vi.advanceTimersByTime(60)).not.toThrow();
      press('y');

      expect(ok).toHaveBeenCalledTimes(1);
      expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
      expect(err).toHaveBeenCalled();
      wk.stop();
      err.mockRestore();
    });
  });

  describe('snapshot emission', () => {
    it('does not notify subscribers for keystrokes that match nothing', () => {
      const wk = createWhichKey();
      wk.register('g h', vi.fn(), { description: 'Deep' });
      wk.start();
      const listener = vi.fn();
      wk.subscribe(listener);
      const before = wk.getSnapshot();

      press('a'); press('b'); press('c'); press('d'); press('e');

      expect(listener).not.toHaveBeenCalled();
      expect(wk.getSnapshot()).toBe(before);
      wk.stop();
    });

    it('still notifies exactly once when the popup actually opens', () => {
      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h', vi.fn(), { description: 'Deep' });
      wk.start();
      const listener = vi.fn();
      wk.subscribe(listener);

      press('g');
      vi.advanceTimersByTime(60);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(wk.getSnapshot().popup.visible).toBe(true);
      wk.stop();
    });
  });

  describe('popup suppression in text fields', () => {
    it('does not show the popup for a leader key typed into a password field', () => {
      const input = document.createElement('input');
      input.type = 'password';
      document.body.appendChild(input);

      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h', vi.fn(), { description: 'Deep', enableOnInputs: false });
      wk.start();

      press('g', input);
      vi.advanceTimersByTime(60);

      expect(wk.getSnapshot().popup.visible).toBe(false);
      expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
      wk.stop();
      input.remove();
    });

    it('still shows the popup for the same key outside a text field', () => {
      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h', vi.fn(), { description: 'Deep' });
      wk.start();

      press('g');
      vi.advanceTimersByTime(60);

      expect(wk.getSnapshot().popup.visible).toBe(true);
      wk.stop();
    });

    it('still completes a deeper sequence whose leaf opted in with enableOnInputs', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      const fn = vi.fn();

      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h', fn, { description: 'Deep', enableOnInputs: true });
      wk.start();

      press('g', input);
      press('h', input);

      expect(fn).toHaveBeenCalledTimes(1);
      wk.stop();
      input.remove();
    });

    it('does not leak a keystroke typed into a field once the sequence continues outside it', () => {
      const input = document.createElement('input');
      input.type = 'password';
      document.body.appendChild(input);

      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h i j', vi.fn(), { description: 'Deep' });
      wk.start();

      press('g');
      vi.advanceTimersByTime(60);
      expect(wk.getSnapshot().popup.visible).toBe(true);
      expect(wk.getSnapshot().popup.currentSequence).toEqual(['g']);

      // 'h' is typed into the password field — buffered, but must never be displayed.
      press('h', input);
      expect(wk.getSnapshot().popup.currentSequence).not.toContain('h');

      // The sequence continues OUTSIDE the field. The buffer now holds
      // ['g','h','i'], but this buffer was touched by an in-field keystroke,
      // so the popup must stay suppressed for the rest of it — 'h' (and the
      // buffer containing it) must never reach the display.
      press('i');
      expect(wk.getSnapshot().popup.currentSequence).not.toContain('h');

      wk.stop();
      input.remove();
    });

    it('clears the field-touched flag on reset so a later outside-only sequence still displays', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);

      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h', vi.fn(), { description: 'Deep' });
      wk.start();

      // First sequence touches the field, then aborts on an unmatched key —
      // this resets the buffer (and must clear the field-touched flag with it).
      press('g', input);
      press('z');
      expect(wk.getSnapshot().popup.visible).toBe(false);

      // A second, wholly-outside sequence must display normally — the flag
      // must not leak across a reset and over-suppress an unrelated sequence.
      press('g');
      vi.advanceTimersByTime(60);
      expect(wk.getSnapshot().popup.visible).toBe(true);
      expect(wk.getSnapshot().popup.currentSequence).toEqual(['g']);

      wk.stop();
      input.remove();
    });

    it('does not leak a field-typed key committed via the leaf-AND-prefix branch', () => {
      const input = document.createElement('input');
      input.type = 'password';
      document.body.appendChild(input);

      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g', vi.fn(), { description: 'Leaf' });
      wk.register('g h i', vi.fn(), { description: 'Deep' });
      wk.start();

      // 'g' is both a registered leaf and a prefix of 'g h i', so it takes
      // the leaf-AND-prefix branch, not the prefix-only branch. Typed into
      // the password field, that branch must still latch the field-touched
      // flag on the buffer it commits.
      press('g', input);

      // Before the leaf's deferred-fire timer elapses, continue OUTSIDE the
      // field. This takes the prefix-only branch; the buffer now holds
      // ['g','h'], but 'g' was typed into the field and must never reach
      // the display.
      press('h');

      expect(wk.getSnapshot().popup.currentSequence).not.toContain('g');
      expect(wk.getSnapshot().popup.visible).toBe(false);

      // Confirm the suppression holds for the rest of this buffer, not just
      // for the instant 'h' was pressed.
      vi.advanceTimersByTime(60);
      expect(wk.getSnapshot().popup.currentSequence).not.toContain('g');

      wk.stop();
      input.remove();
    });

    describe('narrowed latch: only character-echoing keystrokes taint the buffer [Finding 1]', () => {
      it('still shows the popup for a modifier-prefixed leader key pressed in an input (Ctrl+k does not echo a character)', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        const fn = vi.fn();

        const wk = createWhichKey({ timeoutMs: 50 });
        wk.register('Ctrl+k p', fn, { description: 'Command palette', enableOnInputs: true });
        wk.start();

        pressWithInit({ key: 'k', ctrlKey: true }, input);
        vi.advanceTimersByTime(60);

        const snap = wk.getSnapshot();
        expect(snap.popup.visible).toBe(true);
        // Canonical form uppercases the letter when paired with a modifier
        // (matches how a bare `register('Ctrl+k p', ...)` call canonicalizes).
        expect(snap.popup.currentSequence).toEqual(['Ctrl+K']);

        wk.stop();
        input.remove();
      });

      it('still suppresses the popup for a bare printable leader key typed into a password field (security property unchanged)', () => {
        const input = document.createElement('input');
        input.type = 'password';
        document.body.appendChild(input);

        const wk = createWhichKey({ timeoutMs: 50 });
        wk.register('g h', vi.fn(), { description: 'Deep', enableOnInputs: false });
        wk.start();

        press('g', input);
        vi.advanceTimersByTime(60);

        expect(wk.getSnapshot().popup.visible).toBe(false);
        expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
        wk.stop();
        input.remove();
      });

      it('still latches for an AltGr keystroke (Ctrl+Alt+single-char) typed into a field', () => {
        const input = document.createElement('input');
        input.type = 'password';
        document.body.appendChild(input);

        const wk = createWhichKey({ timeoutMs: 50 });
        // AltGr on many European layouts produces '@' via Ctrl+Alt+2 — a
        // character that could plausibly appear in a password. It must still
        // taint the buffer even though a plain Ctrl-chord would not. Use a
        // 3-key sequence so the buffer is still a prefix (not a completed
        // leaf) after the second keystroke, exercising latch persistence.
        wk.register('Ctrl+Alt+@ h i', vi.fn(), { description: 'Deep', enableOnInputs: false });
        wk.start();

        pressWithInit({ key: '@', ctrlKey: true, altKey: true }, input);
        vi.advanceTimersByTime(60);

        expect(wk.getSnapshot().popup.visible).toBe(false);
        expect(wk.getSnapshot().popup.currentSequence).toEqual([]);

        // The taint must survive even as the sequence continues outside the field.
        press('h');
        vi.advanceTimersByTime(60);
        expect(wk.getSnapshot().popup.visible).toBe(false);
        expect(wk.getSnapshot().popup.currentSequence).not.toContain('Ctrl+Alt+@');

        wk.stop();
        input.remove();
      });
    });

    it('hides a stale popup once the buffer is tainted mid-sequence [Finding 3]', () => {
      const input = document.createElement('input');
      input.type = 'password';
      document.body.appendChild(input);

      const wk = createWhichKey({ timeoutMs: 50 });
      wk.register('g h i j', vi.fn(), { description: 'Deep' });
      wk.start();

      // 'g' outside the field — popup shows ['g'].
      press('g');
      vi.advanceTimersByTime(60);
      expect(wk.getSnapshot().popup.visible).toBe(true);
      expect(wk.getSnapshot().popup.currentSequence).toEqual(['g']);

      // 'h' typed into the password field echoes a character — taints the
      // buffer. The stale ['g'] popup must be hidden immediately, not merely
      // left on screen for the rest of the buffer.
      press('h', input);
      expect(wk.getSnapshot().popup.visible).toBe(false);

      // The buffer itself is untouched by the hide — a further keystroke
      // still contributes to it (verified indirectly: no popup reappears).
      press('i', input);
      expect(wk.getSnapshot().popup.visible).toBe(false);

      wk.stop();
      input.remove();
    });
  });
});

describe('controller layers', () => {
  it('exclusive pushLayer suppresses a base shortcut, pop restores it', () => {
    const wk = createWhichKey({ helpKey: null });
    const base = vi.fn();
    wk.register('a', base);
    const layer = wk.pushLayer({ exclusive: true });
    const modal = vi.fn();
    layer.register('b', modal);
    // base 'a' now unreachable, layer 'b' reachable
    expect(wk.registry.getActive('a')).toBeUndefined();
    expect(wk.registry.getActive('b')?.handler).toBeTypeOf('function');
    layer.pop();
    expect(wk.registry.getActive('a')?.handler).toBeTypeOf('function');
    expect(wk.registry.getActive('b')).toBeUndefined(); // handle entries auto-unregistered
  });

  it('handle register survives destructuring (arrow keeps lexical this)', () => {
    const wk = createWhichKey({ helpKey: null });
    const layer = wk.pushLayer({ exclusive: true });
    const { register } = layer;
    expect(() => register('b', vi.fn())).not.toThrow();
    expect(wk.registry.getActive('b')?.handler).toBeTypeOf('function');
  });

  it('global help survives an exclusive layer', () => {
    const wk = createWhichKey(); // default ? help
    wk.pushLayer({ exclusive: true });
    expect(wk.registry.getActive('?')?.id).toBe('__whichkey_default_help__');
  });

  it('cheatsheet excludes suppressed base entries under an exclusive layer', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('a', () => {}, { description: 'base' });
    const layer = wk.pushLayer({ exclusive: true });
    layer.register('b', () => {}, { description: 'modal' });
    const model = wk.getCheatsheetModel();
    const keys = model.standalone.map((s) => s.keys);
    expect(keys).toContain('b');
    expect(keys).not.toContain('a');
  });

  it('pushLayer emits a snapshot', () => {
    const wk = createWhichKey({ helpKey: null });
    const listener = vi.fn();
    wk.subscribe(listener);
    wk.pushLayer({ exclusive: true });
    expect(listener).toHaveBeenCalled();
  });

  it('pop emits a snapshot', () => {
    const wk = createWhichKey({ helpKey: null });
    const layer = wk.pushLayer({ exclusive: true });
    const listener = vi.fn();
    wk.subscribe(listener);
    layer.pop();
    expect(listener).toHaveBeenCalled();
  });

  it('pop is idempotent — a second pop neither throws nor re-emits', () => {
    const wk = createWhichKey({ helpKey: null });
    const layer = wk.pushLayer({ exclusive: true });
    layer.pop();
    const listener = vi.fn();
    wk.subscribe(listener);
    expect(() => layer.pop()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('pushLayer works when destructured (no this dependency)', () => {
    const wk = createWhichKey({ helpKey: null });
    const { pushLayer } = wk;
    let layer: ReturnType<typeof pushLayer> | undefined;
    expect(() => { layer = pushLayer({ exclusive: true }); }).not.toThrow();
    const modal = vi.fn();
    layer!.register('b', modal);
    expect(wk.registry.getActive('b')?.handler).toBeTypeOf('function');
    layer!.pop();
    expect(wk.registry.getActive('b')).toBeUndefined();
  });

  it('? help key toggles cheatsheet while an exclusive layer is active', () => {
    const wk = createWhichKey({ target: document });
    wk.start();
    wk.pushLayer({ exclusive: true });

    // '?' still resolves (global help entry)
    expect(wk.registry.getActive('?')?.id).toBe('__whichkey_default_help__');

    // First press: cheatsheet becomes visible
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(wk.getSnapshot().cheatsheet.visible).toBe(true);

    // Second press: cheatsheet closes again
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    expect(wk.getSnapshot().cheatsheet.visible).toBe(false);

    wk.stop();
  });
});

describe('createWhichKey.register — soft failure on misuse [B14]', () => {
  it('warns and no-ops on an unparseable key string instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    let unregister: (() => void) | undefined;
    expect(() => { unregister = wk.register('Hyper+K', vi.fn()); }).not.toThrow();
    // Pin the exact composed text: keys.ts's thrown Error is already prefixed
    // "whichkey: " on its own, so this also guards against that prefix
    // doubling up with the "[whichkey] " tag this warning adds.
    expect(warn).toHaveBeenCalledWith(
      '[whichkey] invalid key string "Hyper+K": unknown modifier "Hyper" in "Hyper+K"; shortcut not registered.',
    );
    expect(warn.mock.calls[0][0]).not.toContain(': whichkey:');
    expect(() => unregister!()).not.toThrow();
    warn.mockRestore();
  });

  it('warns and no-ops on an empty key string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    expect(() => wk.register('   ', vi.fn())).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid key string'));
    warn.mockRestore();
  });

  it('warns and no-ops when the handler is not a function', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    // Deliberate misuse from untyped JS — the whole point of the guard.
    const notAFunction = 'nope' as unknown as ShortcutHandler;
    expect(() => wk.register('a', notAFunction)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] handler for "a" is not a function'));
    expect(wk.registry.getActive('a')).toBeUndefined();
    warn.mockRestore();
  });

  it('still registers a valid shortcut normally', () => {
    const wk = createWhichKey();
    const off = wk.register('a', vi.fn(), { description: 'Alpha' });
    expect(wk.registry.getActive('a')?.description).toBe('Alpha');
    off();
    expect(wk.registry.getActive('a')).toBeUndefined();
  });
});
