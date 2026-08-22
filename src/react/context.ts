import { createContext } from 'react';
import type { WhichKeyEngine } from '../engine';

/**
 * The engine created by the nearest `<WhichKeyProvider>`, or `null` outside one.
 * An advanced escape hatch — prefer `useShortcut`, `useShortcutGroup`, and
 * `useWhichKeyState`.
 */
export const WhichKeyContext = createContext<WhichKeyEngine | null>(null);
/**
 * The ambient layer level, `{ level: 0 }` outside any `<WhichKeyLayer>`. An
 * advanced escape hatch — prefer nesting `<WhichKeyLayer>`, which sets this and
 * activates the layer for you.
 */
export const LayerContext = createContext<{ level: number }>({ level: 0 });

// One deduped diagnostic for every "used outside <WhichKeyProvider>" path.
// Without this the three hooks warned and the three RENDERERS stayed silent —
// so the most common integration mistake (placing <WhichKeyPopup /> outside
// the provider) presented as "the popup never appears" while shortcuts kept
// firing, sending developers hunting through CSS and z-index instead.
// Deduped because the callers fire from effects that re-run on dep changes.
const warned = new Set<string>();

export const warnNoProvider = (what: string): void => {
  const message =
    `[whichkey] ${what} used outside <WhichKeyProvider>; ` +
    `wrap your app in <WhichKeyProvider> for it to work.`;
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
};

/** Test-only: clears the dedupe set so each test observes a fresh warning. */
export const resetNoProviderWarnings = (): void => warned.clear();
