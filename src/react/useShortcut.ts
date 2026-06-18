import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { WhichKeyContext, LayerContext } from './context';
import type { ShortcutHandler, ShortcutOptions } from '../engine';

export const useShortcut = (
  keys: string, handler: ShortcutHandler, options?: ShortcutOptions,
): void => {
  const engine = useContext(WhichKeyContext);
  const { level } = useContext(LayerContext);
  const handlerRef = useRef(handler);
  useLayoutEffect(() => { handlerRef.current = handler; }, [handler]);
  const description = options?.description;
  const enableOnInputs = options?.enableOnInputs ?? false;
  const priority = options?.priority ?? 0;
  const enabled = options?.enabled ?? true;
  const global = options?.global ?? false;
  useEffect(() => {
    if (!engine) {
      console.warn('[whichkey] useShortcut called outside <WhichKeyProvider>; shortcut will not register.');
      return;
    }
    return engine.register(keys, (event) => handlerRef.current(event), {
      description, enableOnInputs, priority, enabled, global, level,
    });
  }, [engine, keys, description, enableOnInputs, priority, enabled, global, level]);
};
