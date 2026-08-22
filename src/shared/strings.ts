// User-visible copy both renderers must keep identical. The `wk-*` class
// contract has src/__tests__/class-contract.test.tsx to pin it; this parallel
// string contract had nothing, so the two renderers could drift silently.
// Pinned by src/__tests__/copy-contract.test.tsx.
//
// NB: src/engine/registry.ts has its own '(no description)' inside a shadowing
// warning. That is diagnostic text on a different contract and deliberately
// does NOT read from here.

/** Placeholder shown for a cheatsheet entry registered without a description. */
export const NO_DESCRIPTION = '(no description)';
/** Cheatsheet heading, and the popup's `aria-label`. */
export const SHORTCUTS_LABEL = 'Keyboard shortcuts';
/** Dismissal hint at the foot of the cheatsheet panel. */
export const CHEATSHEET_HINT = 'Press Escape to close.';
