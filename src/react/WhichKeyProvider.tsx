import { useEffect, useRef, type ReactNode } from 'react';
import { createWhichKey, type WhichKeyEngine, type SortMode } from '../engine';
import { WhichKeyContext } from './context';

export type WhichKeyProviderProps = {
  children: ReactNode;
  timeoutMs?: number;
  helpKey?: string | null;
  sortKeys?: SortMode;
};

export const WhichKeyProvider = ({
  children, timeoutMs = 500, helpKey = '?', sortKeys,
}: WhichKeyProviderProps) => {
  const engineRef = useRef<WhichKeyEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createWhichKey({ timeoutMs, helpKey, sortKeys });
  }
  const engine = engineRef.current;
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  return <WhichKeyContext.Provider value={engine}>{children}</WhichKeyContext.Provider>;
};
