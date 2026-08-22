import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { WhichKeyContext, warnNoProvider } from './context';
import type { WhichKeyState, WhichKeySnapshot } from '../engine';

const EMPTY: WhichKeySnapshot = {
  popup: { visible: false, currentSequence: [], candidates: [] },
  cheatsheet: { visible: false },
};
const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY;

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
  return useMemo<WhichKeyState>(() => ({
    visible: snapshot.popup.visible,
    currentSequence: snapshot.popup.currentSequence,
    candidates: snapshot.popup.candidates,
    cancel: engine ? engine.cancel : () => {},
  }), [snapshot, engine]);
};
