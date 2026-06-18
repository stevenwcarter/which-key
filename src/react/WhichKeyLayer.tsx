import { useContext, useEffect, type ReactNode } from 'react';
import { WhichKeyContext, LayerContext } from './context';

export type WhichKeyLayerProps = {
  children: ReactNode;
  exclusive?: boolean;
};

export const WhichKeyLayer = ({ children, exclusive = false }: WhichKeyLayerProps) => {
  const engine = useContext(WhichKeyContext);
  const parent = useContext(LayerContext);
  const level = parent.level + 1;
  useEffect(() => {
    if (!engine) {
      console.warn('[whichkey] <WhichKeyLayer> used outside <WhichKeyProvider>; layer inactive.');
      return;
    }
    return engine.activateLayer(level, exclusive);
  }, [engine, level, exclusive]);
  return <LayerContext.Provider value={{ level }}>{children}</LayerContext.Provider>;
};
