import { useContext, useEffect } from 'react';
import { WhichKeyContext, LayerContext } from './context';

export const useShortcutGroup = (
  prefix: string, options: { description: string; priority?: number },
): void => {
  const engine = useContext(WhichKeyContext);
  const { level } = useContext(LayerContext);
  const { description, priority = 0 } = options;
  useEffect(() => {
    if (!engine) {
      console.warn('[whichkey] useShortcutGroup called outside <WhichKeyProvider>; group will not register.');
      return;
    }
    return engine.registerGroup(prefix, { description, priority, level });
  }, [engine, prefix, description, priority, level]);
};
