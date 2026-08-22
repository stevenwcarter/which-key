import { useEffect, useState, type ReactNode } from 'react';
import { createWhichKey, type WhichKeyEngine, type SortMode } from '../engine';
import { WhichKeyContext } from './context';

export type WhichKeyProviderProps = {
  children?: ReactNode;
  timeoutMs?: number;
  helpKey?: string | null;
  sortKeys?: SortMode;
};

export const WhichKeyProvider = ({
  children, timeoutMs = 500, helpKey = '?', sortKeys,
}: WhichKeyProviderProps) => {
  // Lazy initializer runs once on mount and is ignored thereafter, same as the
  // former ref-based lazy-init — but doesn't read a ref during render, which
  // react-hooks/refs (added in eslint-plugin-react-hooks v7) correctly flags.
  const [engine] = useState<WhichKeyEngine>(() => createWhichKey({ timeoutMs, helpKey, sortKeys }));
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  return <WhichKeyContext.Provider value={engine}>{children}</WhichKeyContext.Provider>;
};
