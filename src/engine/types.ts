export type CanonicalKey = string;

export type ShortcutHandler = (event: KeyboardEvent) => void;

export type ShortcutOptions = {
  description?: string;
  enableOnInputs?: boolean;
  priority?: number;
  enabled?: boolean;
  global?: boolean;
  level?: number;
};

export type ShortcutEntry = {
  id: string;
  keys: string;
  handler: ShortcutHandler;
  description: string | undefined;
  enableOnInputs: boolean;
  priority: number;
  enabled: boolean;
  level: number;
  global: boolean;
};

export type GroupEntry = {
  id: string;
  prefix: string;
  description: string;
  priority: number;
  level: number;
};

export type WhichKeyCandidate = {
  keys: string;
  nextKey: string;
  description: string | undefined;
  isGroup: boolean;
};

export type WhichKeyState = {
  visible: boolean;
  currentSequence: string[];
  candidates: WhichKeyCandidate[];
  cancel: () => void;
};

export type KeyComparator = (a: string, b: string) => number;
export type SortMode = 'alphabetical' | 'registration' | KeyComparator;
