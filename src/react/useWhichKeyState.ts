import { useContext, useMemo } from 'react';
import { WhichKeyContext } from './context';
import { useEngineSnapshot } from './useEngineSnapshot';
import type { WhichKeyState } from '../engine';

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
  const snapshot = useEngineSnapshot(engine, what);
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
