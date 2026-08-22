import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { WhichKeyContext, warnNoProvider } from './context';
import type { WhichKeyState, WhichKeySnapshot } from '../engine';

const EMPTY: WhichKeySnapshot = {
  popup: { visible: false, currentSequence: [], candidates: [] },
  cheatsheet: { visible: false },
};
const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY;

/**
 * Subscribes to the engine's popup state through `useSyncExternalStore` and
 * returns it in the shape React components render from.
 *
 * Server rendering — and any render with no `<WhichKeyProvider>` above — yields
 * an empty, invisible state instead of throwing, which is what makes the
 * renderer components SSR-safe. `what` only names the caller in the
 * missing-provider warning.
 */
export const useWhichKeyState = (what = 'useWhichKeyState()'): WhichKeyState => {
  const engine = useContext(WhichKeyContext);
  // From an effect, not render: this hook backs SSR-safe components that must
  // produce no output (and no console noise) on the server.
  useEffect(() => {
    if (!engine) warnNoProvider(what);
  }, [engine, what]);
  const snapshot = useSyncExternalStore(
    engine ? engine.subscribe : noopSubscribe,
    engine ? engine.getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );
  return useMemo<WhichKeyState>(
    () => ({
      visible: snapshot.popup.visible,
      currentSequence: snapshot.popup.currentSequence,
      candidates: snapshot.popup.candidates,
      cancel: engine ? engine.cancel : () => {},
    }),
    [snapshot, engine],
  );
};
