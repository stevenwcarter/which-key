// Shared by both renderers. Previously duplicated verbatim in
// src/react/WhichKeyPopup.tsx and src/vanilla/popup.ts, and both copies were
// identity for NaN (Math.max(0, NaN) === NaN) — which emitted
// `rgba(17, 24, 39, NaN)`, a declaration the CSSOM rejects outright, so the
// popup rendered with NO background and light text on the bare host page.
export const DEFAULT_BACKGROUND_OPACITY = 0.95;
export const DEFAULT_MAX_ROWS = 5;

export const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_BACKGROUND_OPACITY;

export const clampRows = (n: number): number =>
  Number.isFinite(n) ? Math.max(1, Math.floor(n)) : DEFAULT_MAX_ROWS;
