// The pure-DOM half of the cheatsheet's modal behaviour, shared by both
// renderers. It was previously duplicated character-for-character in
// src/react/ShortcutCheatsheet.tsx and src/vanilla/cheatsheet.ts, and the two
// copies had already begun to drift.
//
// Lives under src/shared/ rather than src/engine/ (which stays DOM-light) and
// is deliberately NOT re-exported from any index.ts, so it is internal.
//
// Scope: Tab handling only. Each renderer keeps its own Escape listener —
// cheatsheet modality / Escape double-handling is an open decision recorded in
// bughunt.md and is not settled here.

/** Elements the Tab trap treats as focus stops inside the cheatsheet panel. */
export const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** `id` of the cheatsheet heading; both renderers aim `aria-labelledby` at it. */
export const CHEATSHEET_TITLE_ID = 'wk-cheatsheet-title';

/**
 * Cycles Tab focus inside `panel`, wrapping at both ends. A no-op for every key
 * other than `Tab`, so a renderer can hand it any keydown. With no focusable
 * descendants it parks focus on the panel itself so focus cannot escape.
 */
export const trapTab = (panel: HTMLElement, e: KeyboardEvent): void => {
  if (e.key !== 'Tab') return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  if (items.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
};
