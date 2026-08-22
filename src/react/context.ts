import { createContext } from 'react';
import type { WhichKeyEngine } from '../engine';

export const WhichKeyContext = createContext<WhichKeyEngine | null>(null);
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
