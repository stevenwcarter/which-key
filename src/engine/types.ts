/**
 * A canonicalized key string such as `'Ctrl+Shift+P'`, with sequences joined by
 * single spaces. Produced by `parseKey`/`eventToCanonical` and used verbatim as
 * the registry's map key. An alias for `string`: it names intent in signatures
 * and carries no runtime behavior of its own.
 */
export type CanonicalKey = string;

/** A shortcut callback. Receives the original `keydown` that completed the sequence. */
export type ShortcutHandler = (event: KeyboardEvent) => void;

/** Per-registration options accepted by `engine.register` and `useShortcut`. */
export type ShortcutOptions = {
  /** Human-readable label shown in the popup and cheatsheet. */
  description?: string;
  /** Let the shortcut fire while focus is in a text field. Defaults to `false`. */
  enableOnInputs?: boolean;
  /** Higher wins when several entries share the same key string. Defaults to `0`. */
  priority?: number;
  /** Set `false` to disable the shortcut without unregistering. Defaults to `true`. */
  enabled?: boolean;
  /** Keep the shortcut reachable under an active exclusive layer. Defaults to `false`. */
  global?: boolean;
  /**
   * Layer this registration belongs to. Normally stamped for you by `pushLayer`
   * / `<WhichKeyLayer>`. Must be a non-negative integer; anything else warns and
   * falls back to `0`, which is also the default.
   */
  level?: number;
};

/**
 * A registration once the engine has canonicalized its keys and applied every
 * default — the resolved record the registry stores and `getAllActive()`
 * returns. The engine builds these; consumers pass `ShortcutOptions` instead.
 */
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

/** The canonicalized, defaults-applied form of a `registerGroup` call. */
export type GroupEntry = {
  id: string;
  prefix: string;
  description: string;
  priority: number;
  level: number;
};

/** One popup row: a key that can be pressed next from the current prefix. */
export type WhichKeyCandidate = {
  /** Full key string this row stands for — the pressed prefix plus `nextKey`. */
  keys: string;
  /** The single key to press next, e.g. `'h'` under the prefix `'g'`. */
  nextKey: string;
  /** Label for the row: the group's description, or the leaf shortcut's. */
  description: string | undefined;
  /** True when further keys follow this one, i.e. the row is a prefix, not a leaf. */
  isGroup: boolean;
};

/** The React-shaped view of `WhichKeySnapshot.popup` returned by `useWhichKeyState`. */
export type WhichKeyState = {
  /** Whether the popup should be rendered. */
  visible: boolean;
  /** Keys pressed so far in the pending sequence. Read-only. */
  currentSequence: string[];
  /** Rows to offer for the pending sequence. Read-only. */
  candidates: WhichKeyCandidate[];
  /** Aborts the pending sequence and hides the popup. */
  cancel: () => void;
};

/** Comparator over full canonical key strings; same contract as `Array.prototype.sort`. */
export type KeyComparator = (a: string, b: string) => number;
/**
 * The type of the `sortKeys` option: a built-in ordering or a custom
 * comparator. Defaults to `'registration'`, which leaves candidates in the
 * order they were registered.
 */
export type SortMode = 'alphabetical' | 'registration' | KeyComparator;
