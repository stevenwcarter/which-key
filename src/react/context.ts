import { createContext } from 'react';
import type { WhichKeyEngine } from '../engine';

export const WhichKeyContext = createContext<WhichKeyEngine | null>(null);
export const LayerContext = createContext<{ level: number }>({ level: 0 });
