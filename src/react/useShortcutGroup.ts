import { useContext, useEffect } from 'react';
import { WhichKeyContext, LayerContext, warnNoProvider } from './context';

export const useShortcutGroup = (
  prefix: string, options: { description: string; priority?: number },
): void => {
  const engine = useContext(WhichKeyContext);
  const { level } = useContext(LayerContext);
  const { description, priority = 0 } = options;
  useEffect(() => {
    if (!engine) {
      warnNoProvider('useShortcutGroup()');
      return;
    }
    return engine.registerGroup(prefix, { description, priority, level });
  }, [engine, prefix, description, priority, level]);
};
