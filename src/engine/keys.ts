import type { CanonicalKey } from './types';

const SPECIAL_KEYS = new Set([
  'Escape',
  'Tab',
  'Enter',
  'Backspace',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

// The names this library RECOGNISES as valid bases, for the purpose of the
// "unrecognised base" warning below. This is deliberately a superset of
// SPECIAL_KEYS: SPECIAL_KEYS controls buildCanonical's Shift+-retention rule
// (Shift+Tab stays meaningful) and must not grow, or existing canonical
// strings would silently change. KNOWN_BASES only gates whether we warn —
// every one of these canonicalizes correctly and matches a real event
// already, via the generic "pass the base through verbatim" path.
const KNOWN_BASES = new Set([
  ...SPECIAL_KEYS,
  'Space',
  'Delete',
  'Insert',
  'CapsLock',
  'ContextMenu',
  'PrintScreen',
  'ScrollLock',
  'Pause',
  'NumLock',
  'Clear',
  'Help',
]);

// Consumers reasonably assume a key string is validated, because parseKey
// throws on an unknown MODIFIER. It did not validate the base, so
// register('escape') produced a canonical string no KeyboardEvent can ever
// emit — a silently dead binding. Map the common spellings onto the exact
// `event.key` values the runtime reports.
const SPECIAL_KEY_ALIASES = new Map<string, string>([
  ...[...KNOWN_BASES].map((k): [string, string] => [k.toLowerCase(), k]),
  ['esc', 'Escape'],
  ['spacebar', 'Space'],
  ['up', 'ArrowUp'],
  ['down', 'ArrowDown'],
  ['left', 'ArrowLeft'],
  ['right', 'ArrowRight'],
  ['pgup', 'PageUp'],
  ['pgdn', 'PageDown'],
  ['pagedn', 'PageDown'],
]);

/** `f1`-`f12` in any casing -> `F1`-`F12`. */
const FUNCTION_KEY_RE = /^f([1-9]|1[0-2])$/i;

// F13-F24 are real, rarely-bound-but-legitimate keys that a KeyboardEvent
// reports exactly as spelled here. They're deliberately NOT folded into
// FUNCTION_KEY_RE/buildCanonical's own function-key regex — both stay
// scoped to F1-F12 — this only silences the "unrecognised base" warning for
// the exact spelling a real event reports.
const EXTENDED_FUNCTION_KEY_RE = /^F(1[3-9]|2[0-4])$/;

const normalizeBase = (base: string, input: string): string => {
  if (base.length <= 1) return base;
  const alias = SPECIAL_KEY_ALIASES.get(base.toLowerCase());
  if (alias !== undefined) return alias;
  if (FUNCTION_KEY_RE.test(base)) return base.toUpperCase();
  // Exact-cased alias-table members are already returned above via the
  // case-insensitive alias lookup; this only catches F13-F24, which are
  // deliberately not in the alias table (see EXTENDED_FUNCTION_KEY_RE).
  if (EXTENDED_FUNCTION_KEY_RE.test(base)) return base;
  // Not a name we recognise. Do NOT throw — exotic event.key values
  // ('MediaPlayPause', 'BrowserBack', IME keys) must stay bindable — but a
  // silently dead binding is exactly what this warning exists to prevent.
  console.warn(
    `[whichkey] key string "${input}": "${base}" is not a key name this library ` +
      'recognises; if the browser does not report exactly this value, the binding ' +
      'will never match.',
  );
  return base;
};

const MODIFIER_KEY_NAMES = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta']);

// `navigator` is absent on Node < 21 (package.json allows >= 20) and on any
// SSR/prerender runtime, and `navigator.platform` is deprecated and frozen by
// anti-fingerprinting modes. Reached from parseKey for EVERY `Mod+` binding —
// the spelling the README recommends — so it must never throw.
type PlatformSource = { userAgentData?: { platform?: string }; platform?: string };

const isMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as PlatformSource;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  // Case-insensitive: `userAgentData.platform` reports 'macOS' (lowercase m),
  // which the legacy case-sensitive /Mac/ pattern would miss.
  return /Mac|iPod|iPhone|iPad/i.test(platform);
};

type Modifiers = { ctrl: boolean; alt: boolean; shift: boolean; meta: boolean };

const buildCanonical = (base: string, { ctrl, alt, shift, meta }: Modifiers): CanonicalKey => {
  const isLetter = /^[a-zA-Z]$/.test(base);
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(base);
  const isSpecial = SPECIAL_KEYS.has(base) || base === 'Space' || isFunctionKey;
  const hasNonShiftModifier = ctrl || alt || meta;

  // Letter casing & shift suppression rules:
  //   - Letter:    any modifier (Ctrl/Alt/Cmd/Shift) → uppercase. Emit "Shift+" only when paired with another modifier.
  //   - Special:   keep "Shift+" verbatim (Shift+Tab is meaningful).
  //   - Other:     drop "Shift+" — callers must write the shifted character itself
  //                (write "?" directly; "Shift+/" canonicalizes to "/" and warns).
  let key = base;
  let emitShift = false;
  if (isLetter) {
    key = hasNonShiftModifier || shift ? base.toUpperCase() : base.toLowerCase();
    emitShift = shift && hasNonShiftModifier;
  } else if (isSpecial) {
    emitShift = shift;
  }

  const parts: string[] = [];
  if (ctrl) parts.push('Ctrl');
  if (alt) parts.push('Alt');
  if (emitShift) parts.push('Shift');
  if (meta) parts.push('Cmd');
  parts.push(key);
  return parts.join('+');
};

/**
 * Canonicalizes a live `KeyboardEvent` — the runtime half of the canonical-key
 * contract. Its output must stay byte-identical to `parseKey`'s for the same
 * chord: registry lookups are plain `Map` gets, so any divergence surfaces as a
 * shortcut that silently never fires.
 */
export const eventToCanonical = (event: KeyboardEvent): CanonicalKey => {
  const raw = event.key;
  const base = raw === ' ' ? 'Space' : raw;
  return buildCanonical(base, {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  });
};

/**
 * True when the keydown is a bare `Shift`/`Control`/`Alt`/`Meta` press with
 * nothing chorded onto it yet. The matcher ignores these, so holding a modifier
 * never aborts a pending sequence.
 */
export const isModifierOnlyEvent = (event: KeyboardEvent): boolean =>
  MODIFIER_KEY_NAMES.has(event.key);

type ModifierName = 'Ctrl' | 'Alt' | 'Shift' | 'Cmd' | 'Mod';

const MODIFIER_ALIASES = new Map<string, ModifierName>([
  ['ctrl', 'Ctrl'],
  ['control', 'Ctrl'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
  ['cmd', 'Cmd'],
  ['meta', 'Cmd'],
  ['command', 'Cmd'],
  ['mod', 'Mod'],
]);

// US-layout characters that a Shift press turns into something else. Used only
// to decide whether to warn — never to rewrite the key, which would guess wrong
// on non-US layouts.
const SHIFT_ALTERS_US = new Set([
  '`',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  '-',
  '=',
  '[',
  ']',
  '\\',
  ';',
  "'",
  ',',
  '.',
  '/',
]);

// The modifier half of parseKey: everything before the final `+`. Returns the
// flags buildCanonical consumes, so parseKey's own body is left with base
// resolution and the two warning rules.
const parseModifiers = (segments: string[], input: string): Modifiers => {
  const mods: Modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  for (const seg of segments) {
    const mod = MODIFIER_ALIASES.get(seg.toLowerCase());
    if (mod === undefined) {
      throw new Error(`whichkey: unknown modifier "${seg}" in "${input}"`);
    }
    switch (mod) {
      case 'Ctrl':
        mods.ctrl = true;
        break;
      case 'Alt':
        mods.alt = true;
        break;
      case 'Shift':
        mods.shift = true;
        break;
      case 'Cmd':
        mods.meta = true;
        break;
      case 'Mod':
        if (isMacPlatform()) mods.meta = true;
        else mods.ctrl = true;
        break;
      default: {
        const exhaustive: never = mod;
        throw new Error(`whichkey: unknown modifier "${String(exhaustive)}" in "${input}"`);
      }
    }
  }
  return mods;
};

/**
 * Canonicalizes one chord written as a key string — the registration half of
 * the canonical-key contract, which `eventToCanonical` must match byte for
 * byte.
 *
 * Modifier names are case-insensitive and accept the usual aliases
 * (`control`, `option`, `meta`/`command`, `mod`); `Mod` resolves to `Cmd` on
 * macOS and `Ctrl` everywhere else. A bare uppercase letter implies Shift, so
 * `parseKey('N')` matches a real Shift+n press.
 *
 * Throws on an empty string, an unknown modifier, or a missing base after a
 * `+`. A base that is not a key name this library recognises only warns and
 * passes through verbatim, so exotic `event.key` values stay bindable.
 */
export const parseKey = (input: string): CanonicalKey => {
  if (!input || input.trim() === '') {
    throw new Error('whichkey: empty key string');
  }
  const segments = input.split('+');
  const baseRaw = segments.pop();
  if (baseRaw === undefined || baseRaw === '' || MODIFIER_ALIASES.has(baseRaw.toLowerCase())) {
    throw new Error(`whichkey: missing key after modifier(s) in "${input}"`);
  }
  const mods = parseModifiers(segments, input);

  const base = baseRaw === ' ' ? 'Space' : normalizeBase(baseRaw, input);
  // A bare uppercase letter (no other modifier) implies Shift was held to
  // produce it. Without this, parseKey('N') would canonicalize to 'n' but
  // pressing Shift+n at runtime canonicalizes to 'N' — they'd never match.
  if (/^[A-Z]$/.test(base) && !mods.ctrl && !mods.alt && !mods.meta && !mods.shift) {
    mods.shift = true;
  }

  if (mods.shift && SHIFT_ALTERS_US.has(base)) {
    console.warn(
      `[whichkey] "${input}": Shift is dropped for punctuation and digits — write the ` +
        `shifted character directly (e.g. "?" not "Shift+/"). This binding will match "${base}".`,
    );
  }

  return buildCanonical(base, mods);
};

/**
 * Splits a space-separated sequence and canonicalizes each chord with
 * `parseKey`. Throws on an empty or whitespace-only string, and on any chord
 * `parseKey` itself rejects.
 */
export const parseSequence = (input: string): CanonicalKey[] => {
  if (!input || input.trim() === '') {
    throw new Error('whichkey: empty sequence string');
  }
  return input
    .split(' ')
    .filter((s) => s.length > 0)
    .map(parseKey);
};

/**
 * True when `target` is a text-entry element — an `<input>`, a `<textarea>`, or
 * anything content-editable. Backs the `enableOnInputs` guard: a shortcut
 * registered without it is suppressed while such an element has focus.
 */
export const isInputTarget = (target: EventTarget | null): boolean => {
  if (!target) return false;
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  // Fallback for environments (e.g. jsdom) where `isContentEditable` does not
  // reflect the attribute without a layout pass — inspect the attribute directly.
  const attr = target.getAttribute('contenteditable');
  if (attr !== null && attr.toLowerCase() !== 'false') return true;
  return false;
};
