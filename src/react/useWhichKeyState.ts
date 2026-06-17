import { useContext, useMemo, useSyncExternalStore } from 'react';
import { WhichKeyContext } from './context';
import type { WhichKeyState, WhichKeySnapshot } from '../engine';

const EMPTY: WhichKeySnapshot = {
  popup: { visible: false, currentSequence: [], candidates: [] },
  cheatsheet: { visible: false },
};
const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY;

export const useWhichKeyState = (): WhichKeyState => {
  const engine = useContext(WhichKeyContext);
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
