import { useEffect, useState, type ReactNode } from 'react';
import { createWhichKey, type WhichKeyEngine, type SortMode } from '../engine';
import { WhichKeyContext } from './context';

/**
 * Props for `<WhichKeyProvider>`. `timeoutMs`, `helpKey`, and `sortKeys` are
 * read once when the provider mounts — the engine is created once and lives for
 * the provider's lifetime, so changing them on a later render has no effect.
 */
export type WhichKeyProviderProps = {
  /** Subtree that gets access to the engine. */
  children?: ReactNode;
  /** Sequence timeout in milliseconds. Defaults to `500`. */
  timeoutMs?: number;
  /** Key that toggles the cheatsheet. Defaults to `'?'`; `null` disables it. */
  helpKey?: string | null;
  /** Popup and cheatsheet sort order. Defaults to `'registration'`. */
  sortKeys?: SortMode;
};

/**
 * Creates the engine once, starts it on mount, and stops it on unmount. Must
 * wrap any component that calls `useShortcut`, `useShortcutGroup`, or
 * `useWhichKeyState`, or that renders `<WhichKeyPopup>`,
 * `<ShortcutCheatsheet>`, or `<WhichKeyLayer>`.
 */
export const WhichKeyProvider = ({
  children,
  timeoutMs = 500,
  helpKey = '?',
  sortKeys,
}: WhichKeyProviderProps) => {
  // Lazy initializer runs once on mount and is ignored thereafter, same as the
  // former ref-based lazy-init — but doesn't read a ref during render, which
  // react-hooks/refs (added in eslint-plugin-react-hooks v7) correctly flags.
  const [engine] = useState<WhichKeyEngine>(() => createWhichKey({ timeoutMs, helpKey, sortKeys }));
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  return <WhichKeyContext.Provider value={engine}>{children}</WhichKeyContext.Provider>;
};
