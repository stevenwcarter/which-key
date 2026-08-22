import { useEffect, useSyncExternalStore } from 'react';
import { warnNoProvider } from './context';
import type { WhichKeyEngine, WhichKeySnapshot } from '../engine';

// Hoisted, never a per-call literal: useSyncExternalStore compares the
// getSnapshot result by identity and re-renders forever if a fresh object comes
// back each time. This is the no-provider / server fallback for every renderer.
const EMPTY: WhichKeySnapshot = {
  popup: { visible: false, currentSequence: [], candidates: [] },
  cheatsheet: { visible: false },
};
const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY;

/**
 * Subscribes to `engine` through `useSyncExternalStore`, falling back to a
 * stable empty snapshot with no engine — during server rendering, or below no
 * `<WhichKeyProvider>` — instead of throwing. `what` only names the caller in
 * the missing-provider warning, which is emitted from an effect so the server
 * stays silent.
 */
export const useEngineSnapshot = (
  engine: WhichKeyEngine | null,
  what: string,
): WhichKeySnapshot => {
  useEffect(() => {
    if (!engine) warnNoProvider(what);
  }, [engine, what]);
  return useSyncExternalStore(
    engine ? engine.subscribe : noopSubscribe,
    engine ? engine.getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );
};
