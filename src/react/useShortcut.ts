import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { WhichKeyContext, LayerContext, warnNoProvider } from './context';
import type { ShortcutHandler, ShortcutOptions } from '../engine';

/**
 * Registers a shortcut for the lifetime of the component, stamped with the
 * ambient `<WhichKeyLayer>` level.
 *
 * `handler` is held in a ref, so it need not be stable and never causes a
 * re-registration on its own. Re-registration happens when the engine, `keys`,
 * or an individual option value changes — a fresh `options` object carrying the
 * same values does not trigger one.
 */
export const useShortcut = (
  keys: string,
  handler: ShortcutHandler,
  options?: ShortcutOptions,
): void => {
  const engine = useContext(WhichKeyContext);
  const { level } = useContext(LayerContext);
  const handlerRef = useRef(handler);
  useLayoutEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  const description = options?.description;
  const enableOnInputs = options?.enableOnInputs ?? false;
  const priority = options?.priority ?? 0;
  const enabled = options?.enabled ?? true;
  const global = options?.global ?? false;
  useEffect(() => {
    if (!engine) {
      warnNoProvider('useShortcut()');
      return;
    }
    return engine.register(keys, (event) => handlerRef.current(event), {
      description,
      enableOnInputs,
      priority,
      enabled,
      global,
      level,
    });
  }, [engine, keys, description, enableOnInputs, priority, enabled, global, level]);
};
