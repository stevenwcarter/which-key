import { useContext, useEffect, type ReactNode } from 'react';
import { WhichKeyContext, LayerContext, warnNoProvider } from './context';

/** Props for `<WhichKeyLayer>`. */
export type WhichKeyLayerProps = {
  /** Subtree whose shortcuts and groups belong to this layer. */
  children: ReactNode;
  /**
   * When `true`, shortcuts at lower levels become unreachable unless they were
   * registered with `global: true`. Defaults to `false`, which leaves the layer
   * additive.
   */
  exclusive?: boolean;
};

/**
 * Scopes every `useShortcut` / `useShortcutGroup` call in its subtree to a
 * nested keybinding layer, activated on mount and deactivated on unmount.
 *
 * The level is derived from React tree depth (`parent.level + 1`), so nesting
 * these components stacks levels — but two sibling layers under the same parent
 * share a level and therefore do not isolate from each other.
 */
export const WhichKeyLayer = ({ children, exclusive = false }: WhichKeyLayerProps) => {
  const engine = useContext(WhichKeyContext);
  const parent = useContext(LayerContext);
  const level = parent.level + 1;
  useEffect(() => {
    if (!engine) {
      warnNoProvider('<WhichKeyLayer>');
      return;
    }
    return engine.activateLayer(level, exclusive);
  }, [engine, level, exclusive]);
  return <LayerContext.Provider value={{ level }}>{children}</LayerContext.Provider>;
};
