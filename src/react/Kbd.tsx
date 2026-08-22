import type { ReactNode } from 'react';

/**
 * A single key cap. Module-private: not re-exported from src/react/index.ts,
 * which keeps the React side's only `wk-kbd` literal here.
 */
export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="wk-kbd">{children}</kbd>
);
