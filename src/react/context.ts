import { createContext } from 'react';
import type { WhichKeyEngine } from '../engine';

export const WhichKeyContext = createContext<WhichKeyEngine | null>(null);
