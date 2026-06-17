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

const MODIFIER_KEY_NAMES = new Set(['Shift', 'Control', 'Alt', 'Meta']);

const isMacPlatform = (): boolean => /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const buildCanonical = (
  base: string,
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
  meta: boolean,
): CanonicalKey => {
  const isLetter = /^[a-zA-Z]$/.test(base);
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(base);
  const isSpecial = SPECIAL_KEYS.has(base) || base === 'Space' || isFunctionKey;
  const hasNonShiftModifier = ctrl || alt || meta;

  // Letter casing & shift suppression rules:
  //   - Letter:    any modifier (Ctrl/Alt/Cmd/Shift) → uppercase. Emit "Shift+" only when paired with another modifier.
  //   - Special:   keep "Shift+" verbatim (Shift+Tab is meaningful).
  //   - Other:     drop "Shift+" — the shifted form is already in the base character (Shift+/ → ?).
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

export const eventToCanonical = (event: KeyboardEvent): CanonicalKey => {
  const raw = event.key;
  const base = raw === ' ' ? 'Space' : raw;
  return buildCanonical(base, event.ctrlKey, event.altKey, event.shiftKey, event.metaKey);
};

export const isModifierOnlyEvent = (event: KeyboardEvent): boolean =>
  MODIFIER_KEY_NAMES.has(event.key);

const KNOWN_MODIFIERS = new Set(['Ctrl', 'Alt', 'Shift', 'Cmd', 'Mod']);

export const parseKey = (input: string): CanonicalKey => {
  if (!input || input.trim() === '') {
    throw new Error('whichkey: empty key string');
  }
  const segments = input.split('+');
  const baseRaw = segments.pop() as string;
  if (baseRaw === '' || KNOWN_MODIFIERS.has(baseRaw)) {
    throw new Error(`whichkey: missing key after modifier(s) in "${input}"`);
  }
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;

  for (const seg of segments) {
    if (!KNOWN_MODIFIERS.has(seg)) {
      throw new Error(`whichkey: unknown modifier "${seg}" in "${input}"`);
    }
    switch (seg) {
      case 'Ctrl':
        ctrl = true;
        break;
      case 'Alt':
        alt = true;
        break;
      case 'Shift':
        shift = true;
        break;
      case 'Cmd':
        meta = true;
        break;
      case 'Mod':
        if (isMacPlatform()) meta = true;
        else ctrl = true;
        break;
    }
  }

  const base = baseRaw === ' ' ? 'Space' : baseRaw;
  // A bare uppercase letter (no other modifier) implies Shift was held to
  // produce it. Without this, parseKey('N') would canonicalize to 'n' but
  // pressing Shift+n at runtime canonicalizes to 'N' — they'd never match.
  if (/^[A-Z]$/.test(base) && !ctrl && !alt && !meta && !shift) {
    shift = true;
  }
  return buildCanonical(base, ctrl, alt, shift, meta);
};

export const parseSequence = (input: string): CanonicalKey[] => {
  if (!input || input.trim() === '') {
    throw new Error('whichkey: empty sequence string');
  }
  return input
    .split(' ')
    .filter((s) => s.length > 0)
    .map(parseKey);
};

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
