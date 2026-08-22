import { ShortcutRegistry } from './registry';
import { Matcher } from './matcher';
import { parseKey, parseSequence } from './keys';
import { resolveSort } from './sort';
import type {
  KeyComparator,
  ShortcutHandler,
  ShortcutOptions,
  ShortcutEntry,
  WhichKeyCandidate,
  SortMode,
} from './types';

const DEFAULT_HELP_ID = '__whichkey_default_help__';
const DEFAULT_TIMEOUT_MS = 500;
// The largest delay setTimeout honours: it stores the delay in a signed
// 32-bit int, so anything past this overflows and is coerced to fire almost
// immediately — the same silent-instant-fire failure as NaN/negative, just
// reached from the other direction.
const MAX_SETTIMEOUT_DELAY_MS = 2147483647;

// keys.ts's thrown Errors are already prefixed "whichkey: " (correct for
// that Error surfacing on its own, unwrapped). Strip it here so composing it
// into a "[whichkey] ..." warning doesn't double the tag (was: '[whichkey]
// invalid key string "...": whichkey: ...'). Any soft-fail site that
// composes another module's Error message into a [whichkey] warning should
// route it through this helper.
const stripWhichkeyPrefix = (message: string): string => message.replace(/^whichkey:\s*/, '');

// Every soft-fail site that composes another module's Error into a
// [whichkey] warning needs the same two steps: coerce a non-Error throw to a
// string, then strip keys.ts's own "whichkey: " prefix so the composed
// warning isn't double-tagged.
const describeError = (err: unknown): string =>
  stripWhichkeyPrefix(err instanceof Error ? err.message : String(err));

// register() and registerGroup() canonicalize into the SAME namespace and
// soft-fail the same way; only the noun and the consequence clause differ.
// Returns null rather than throwing so the caller can hand back a no-op
// unregister. The emitted strings are enumerated in docs/API.md's Console
// warnings table — keep them byte-identical.
const canonicalizeOrWarn = (input: string, noun: string, consequence: string): string | null => {
  try {
    return parseSequence(input).join(' ');
  } catch (err) {
    console.warn(`[whichkey] invalid ${noun} "${input}": ${describeError(err)}; ${consequence}.`);
    return null;
  }
};

// `level` is public on ShortcutOptions and on registerGroup's options. A
// negative or non-integer value is silently fatal: blockLevel() floors at 0
// and isReachable requires entry.level >= block, so the entry registers, the
// unregister function looks healthy, and the key simply never fires. B34
// closed the same hole for pushLayer; this is the registration-side twin.
// Falls back to 0 rather than nextLevel() — a bare registration has no layer
// of its own, and 0 is the documented default.
const resolveLevel = (requested: number | undefined, what: string): number => {
  if (requested === undefined) return 0;
  if (Number.isInteger(requested) && requested >= 0) return requested;
  console.warn(
    `[whichkey] invalid level ${String(requested)} for "${what}"; ` +
      'expected a non-negative integer. Falling back to 0.',
  );
  return 0;
};

// setTimeout silently coerces NaN / negative / overflow to 0, which turns
// "wait before showing the popup" into "fire instantly" with no diagnostic.
// Validate at the boundary; the public timeoutMs?: number stays unchanged.
const resolveTimeoutMs = (raw: number | undefined): number => {
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  if (Number.isFinite(raw) && raw >= 0 && raw <= MAX_SETTIMEOUT_DELAY_MS) return raw;
  console.warn(
    `[whichkey] invalid timeoutMs ${String(raw)}; falling back to ${DEFAULT_TIMEOUT_MS}ms.`,
  );
  return DEFAULT_TIMEOUT_MS;
};

/**
 * Options accepted by `createWhichKey`. Every field is optional, and an invalid
 * value warns and falls back to its default rather than throwing.
 */
export type WhichKeyOptions = {
  /**
   * Milliseconds of inactivity before a partial sequence is cancelled. Defaults
   * to `500`; a non-finite, negative, or `setTimeout`-overflowing value warns
   * and falls back to `500`.
   */
  timeoutMs?: number;
  /**
   * Key that toggles the cheatsheet. Defaults to `'?'`. `null` disables the
   * built-in help shortcut silently; `''`, or a string `parseKey` cannot parse,
   * disables it with a warning.
   */
  helpKey?: string | null;
  /** Order of candidates in the popup and cheatsheet. Defaults to `'registration'`. */
  sortKeys?: SortMode;
  /** Node `start()` installs the `keydown` listener on. Defaults to `document`. */
  target?: Document | HTMLElement;
};

/** One cheatsheet row: a shortcut's canonical key string and its label. */
export type CheatsheetEntry = { keys: string; description: string | undefined };
/**
 * A first key and the shortcuts filed under it. `description` is the label from
 * a matching `registerGroup`, or `undefined` when no group was registered.
 */
export type CheatsheetGroup = {
  prefix: string;
  description: string | undefined;
  entries: CheatsheetEntry[];
};
/**
 * The cheatsheet view model returned by `engine.getCheatsheetModel()`. A
 * shortcut is `standalone` only when it is the sole entry filed under its first
 * key, its whole key string is that one key, and no group label is registered
 * for it; everything else is bucketed by first key into `groups`.
 */
export type CheatsheetModel = { standalone: CheatsheetEntry[]; groups: CheatsheetGroup[] };

/**
 * Immutable view of the engine's UI state, handed to `subscribe` listeners and
 * returned by `getSnapshot()`.
 *
 * Two invariants consumers depend on: the object identity is stable between
 * emits (`getSnapshot()` returns the cached snapshot, which is what keeps
 * `useSyncExternalStore` from re-rendering forever), and the whole tree —
 * `currentSequence` and `candidates` included — must be treated as read-only.
 */
export type WhichKeySnapshot = {
  popup: { visible: boolean; currentSequence: string[]; candidates: WhichKeyCandidate[] };
  cheatsheet: { visible: boolean };
};

/**
 * Handle returned by `pushLayer`. Its `register` and `registerGroup` behave
 * like the engine methods of the same name but stamp this handle's `level` onto
 * each registration and track it, so `pop()` can unregister everything the
 * handle created and then deactivate the layer. `pop()` is idempotent.
 */
export type LayerHandle = {
  readonly level: number;
  register: WhichKeyEngine['register'];
  registerGroup: WhichKeyEngine['registerGroup'];
  pop(): void;
};

/** The object returned by `createWhichKey`. */
export type WhichKeyEngine = {
  /**
   * Registers a shortcut and returns its unregister function. An unparseable
   * `keys` string or a non-function handler warns and returns a no-op
   * unregister rather than throwing.
   */
  register(keys: string, handler: ShortcutHandler, options?: ShortcutOptions): () => void;
  /**
   * Labels a key prefix in the popup and cheatsheet, and returns an unregister
   * function. An unparseable prefix warns and returns a no-op.
   */
  registerGroup(
    prefix: string,
    options: { description: string; priority?: number; level?: number },
  ): () => void;
  /**
   * Activates a layer at an explicit level without owning any registrations,
   * and returns an idempotent deactivate function. Prefer `pushLayer` unless
   * you are managing registration lifetimes yourself.
   */
  activateLayer(level: number, exclusive: boolean): () => void;
  /** Pushes a layer and returns a handle owning everything registered through it. */
  pushLayer(options?: { exclusive?: boolean; level?: number }): LayerHandle;
  /** Attaches the `keydown` listener to the configured target. Idempotent. */
  start(): void;
  /** Detaches the listener and cancels any in-progress sequence. Idempotent. */
  stop(): void;
  /** Subscribes to state changes; returns an unsubscribe function. */
  subscribe(listener: (snapshot: WhichKeySnapshot) => void): () => void;
  /**
   * Returns the current snapshot. The identity is cached and changes only when
   * the state does, so it is safe to hand straight to `useSyncExternalStore`.
   */
  getSnapshot(): WhichKeySnapshot;
  /** Opens the cheatsheet; no-op if already open. */
  openCheatsheet(): void;
  /** Closes the cheatsheet; no-op if already closed. */
  closeCheatsheet(): void;
  /** Toggles the cheatsheet. */
  toggleCheatsheet(): void;
  /** Cancels any in-progress key sequence and hides the popup. */
  cancel(): void;
  /** Builds the cheatsheet view model — useful for a custom cheatsheet UI. */
  getCheatsheetModel(): CheatsheetModel;
  /**
   * The underlying registry. Advanced use only, and effectively read-only: the
   * supported read is `getAllActive()`, and calling the mutators directly
   * bypasses the engine's bookkeeping.
   */
  readonly registry: ShortcutRegistry;
};

// Phase 1 of buildCheatsheetModel: file every active shortcut under its
// leading key. Bucket insertion order follows registry.getAllActive(), which
// is what makes sortKeys: 'registration' mean "registration order".
const bucketByFirstKey = (entries: ShortcutEntry[]): Map<string, CheatsheetEntry[]> => {
  const buckets = new Map<string, CheatsheetEntry[]>();
  for (const entry of entries) {
    const first = entry.keys.split(' ')[0];
    const list = buckets.get(first) ?? [];
    list.push({ keys: entry.keys, description: entry.description });
    buckets.set(first, list);
  }
  return buckets;
};

const buildCheatsheetModel = (
  registry: ShortcutRegistry,
  cmp: KeyComparator | undefined,
): CheatsheetModel => {
  // 1. bucket entries by their leading key
  const buckets = bucketByFirstKey(registry.getAllActive().filter((e) => e.id !== DEFAULT_HELP_ID));

  // 2. partition into standalone shortcuts vs labelled groups
  const standalone: CheatsheetEntry[] = [];
  const groups: CheatsheetGroup[] = [];
  for (const [prefix, entries] of buckets) {
    // A single entry whose keys ARE the prefix is a standalone shortcut —
    // unless the consumer registered a group label for that prefix, in which
    // case standalone would silently drop the label (standalone entries carry
    // no group description).
    if (entries.length === 1 && entries[0].keys === prefix && !registry.getActiveGroup(prefix)) {
      standalone.push(entries[0]);
    } else {
      groups.push({ prefix, description: registry.getActiveGroup(prefix)?.description, entries });
    }
  }

  // 3. apply the caller's key comparator
  if (cmp) {
    standalone.sort((a, b) => cmp(a.keys, b.keys));
    for (const g of groups) g.entries.sort((a, b) => cmp(a.keys, b.keys));
    groups.sort((a, b) => cmp(a.prefix, b.prefix));
  }
  return { standalone, groups };
};

// `null` is the documented way to disable help deliberately and stays
// silent. `''` is almost certainly a mistake — it is falsy, so it skipped
// registration without ever reaching parseKey, making it the one
// invalid-input path in the library that failed with no diagnostic.
const registerHelpShortcut = (
  registry: ShortcutRegistry,
  helpKey: string | null | undefined,
  onToggle: () => void,
): void => {
  if (helpKey === '') {
    console.warn('[whichkey] invalid helpKey ""; help shortcut disabled.');
    return;
  }
  if (!helpKey) return;
  // Soft-fail: WhichKeyProvider calls createWhichKey in its RENDER body, so
  // a throw here unmounts the consumer's entire tree with no error boundary
  // in between. Matches useShortcut's missing-provider warn convention.
  try {
    registry.register({
      id: DEFAULT_HELP_ID,
      keys: parseKey(helpKey),
      handler: () => onToggle(),
      description: 'Toggle keyboard shortcuts',
      enableOnInputs: false,
      priority: -1,
      enabled: true,
      level: 0,
      global: true,
    });
  } catch (err) {
    console.warn(
      `[whichkey] invalid helpKey "${helpKey}": ${describeError(err)}; help shortcut disabled.`,
    );
  }
};

/**
 * Creates a which-key engine: a registry, a matcher, and the snapshot store the
 * renderers subscribe to.
 *
 * No `keydown` listener is bound until `start()` is called. Invalid options
 * soft-fail — a bad `timeoutMs` warns and falls back to `500`, a bad `helpKey`
 * warns and leaves the built-in help shortcut disabled — because the React
 * provider calls this from its render body, where a throw would take down the
 * consumer's tree.
 */
export const createWhichKey = (options: WhichKeyOptions = {}): WhichKeyEngine => {
  // --- options & mutable state ---
  const { helpKey = '?', sortKeys } = options;
  const timeoutMs = resolveTimeoutMs(options.timeoutMs);
  const explicitTarget = options.target;
  let bound: Document | HTMLElement | null = null;
  const registry = new ShortcutRegistry();
  const cmp = resolveSort(sortKeys);
  const listeners = new Set<(snapshot: WhichKeySnapshot) => void>();

  let popupVisible = false;
  let currentSequence: string[] = [];
  let cheatsheetVisible = false;
  let idCounter = 0;
  let started = false;

  // --- snapshot computation & emission ---
  const computeCandidates = (): WhichKeyCandidate[] => {
    const prefix = currentSequence.join(' ');
    const raw = prefix ? registry.getActiveCandidates(prefix) : [];
    return cmp ? [...raw].sort((a, b) => cmp(a.nextKey, b.nextKey)) : raw;
  };

  const computeSnapshot = (): WhichKeySnapshot => ({
    popup: { visible: popupVisible, currentSequence, candidates: computeCandidates() },
    cheatsheet: { visible: cheatsheetVisible },
  });

  let snapshot = computeSnapshot();

  const emit = (): void => {
    snapshot = computeSnapshot();
    // Guard each listener the way onFire guards consumer handlers below.
    // emit() runs synchronously inside Matcher.handleKeyDown — the
    // leaf-AND-prefix branch calls onShowPopup (matcher.ts:135) AFTER
    // clearTimer() but BEFORE arming the fire timer (matcher.ts:150) — so an
    // escaping throw leaves the buffer committed with no pending timer, the
    // leaf never fires, the popup never appears, and every listener after the
    // thrower misses the snapshot. One engine can drive both
    // <WhichKeyProvider> and mountWhichKey, and a custom sortKeys comparator
    // can throw inside the vanilla render subscriber, so this is reachable.
    for (const l of listeners) {
      try {
        l(snapshot);
      } catch (err) {
        console.error(
          '[whichkey] A subscriber threw while receiving a snapshot; ' +
            'other subscribers were still notified.',
          err,
        );
      }
    }
  };

  const toggleCheatsheet = (): void => {
    cheatsheetVisible = !cheatsheetVisible;
    emit();
  };

  const matcher = new Matcher(registry, {
    timeoutMs,
    onFire: (entry, event) => {
      try {
        entry.handler(event);
      } catch (err) {
        console.error(
          `[whichkey] Handler for "${entry.keys}" threw; sequence state was reset.`,
          err,
        );
      }
    },
    onShowPopup: (state) => {
      popupVisible = true;
      // Defensive copy: never store the Matcher's live array in a snapshot.
      // Snapshots are handed to useSyncExternalStore consumers and must be
      // immutable; aliasing the Matcher's buffer would let a later mutation
      // silently corrupt an already-emitted snapshot.
      currentSequence = [...state.currentSequence];
      emit();
    },
    onHidePopup: () => {
      if (!popupVisible && currentSequence.length === 0) return;
      popupVisible = false;
      currentSequence = [];
      emit();
    },
  });

  registerHelpShortcut(registry, helpKey, toggleCheatsheet);

  const handler = (event: Event) => matcher.handleKeyDown(event as KeyboardEvent);

  // --- engine surface ---
  const engine: WhichKeyEngine = {
    registry,
    register(keys, h, opts) {
      // Soft-fail on consumer misuse, matching useShortcut's missing-provider
      // warn. register() runs inside a useEffect in the React binding, where a
      // throw is unrecoverable and unmounts the consumer's whole subtree.
      if (typeof h !== 'function') {
        console.warn(
          `[whichkey] handler for "${keys}" is not a function; shortcut not registered.`,
        );
        return () => {};
      }
      const canonical = canonicalizeOrWarn(keys, 'key string', 'shortcut not registered');
      if (canonical === null) return () => {};
      const id = `wk_${idCounter++}`;
      const entry: ShortcutEntry = {
        id,
        keys: canonical,
        handler: h,
        description: opts?.description,
        enableOnInputs: opts?.enableOnInputs ?? false,
        priority: opts?.priority ?? 0,
        enabled: opts?.enabled ?? true,
        level: resolveLevel(opts?.level, keys),
        global: opts?.global ?? false,
      };
      registry.register(entry);
      return () => registry.unregister(id);
    },
    registerGroup(prefix, opts) {
      // Canonicalize into the SAME namespace register() uses. Storing the raw
      // prefix meant registerGroup('Shift+a') and register('Shift+a b') keyed
      // differently ('Shift+a' vs 'A b'), so the label silently never rendered.
      const canonical = canonicalizeOrWarn(prefix, 'group prefix', 'group not registered');
      if (canonical === null) return () => {};
      const id = `wkg_${idCounter++}`;
      registry.registerGroup({
        id,
        prefix: canonical,
        description: opts.description,
        priority: opts.priority ?? 0,
        level: resolveLevel(opts.level, prefix),
      });
      return () => registry.unregisterGroup(id);
    },
    activateLayer(level, exclusive) {
      const id = `wklayer_${idCounter++}`;
      registry.activateLayer(id, level, exclusive);
      emit();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        registry.deactivateLayer(id);
        emit();
      };
    },
    pushLayer(opts) {
      const nextLevel = registry.nextLevel();
      // A negative level is permanently unreachable: blockLevel() floors at 0
      // and isReachable requires entry.level >= block, so every shortcut on
      // the layer registers fine, the handle looks healthy, and the keys
      // silently never fire. Non-integers and non-finite values are equally
      // meaningless as level ordinals.
      const requested = opts?.level;
      let level: number;
      if (requested === undefined) {
        level = nextLevel;
      } else if (!Number.isInteger(requested) || requested < 0) {
        console.warn(
          `[whichkey] invalid pushLayer level ${String(requested)}; ` +
            `expected a non-negative integer. Falling back to ${nextLevel}.`,
        );
        level = nextLevel;
      } else {
        if (requested < nextLevel - 1) {
          console.warn(
            `[whichkey] pushLayer level ${requested} undercuts the next free level ` +
              `(${nextLevel}); shortcuts on this layer may be blocked by an active exclusive layer.`,
          );
        }
        level = requested;
      }
      const deactivate = engine.activateLayer(level, opts?.exclusive ?? false);
      const owned = new Set<() => void>();
      const track = (un: () => void): (() => void) => {
        const wrapped = () => {
          un();
          owned.delete(wrapped);
        };
        owned.add(wrapped);
        return wrapped;
      };
      return {
        level,
        register: (keys, h, o) => track(engine.register(keys, h, { ...o, level })),
        registerGroup: (prefix, o) => track(engine.registerGroup(prefix, { ...o, level })),
        pop: () => {
          for (const un of [...owned]) un();
          deactivate();
        },
      };
    },
    start() {
      if (started) return;
      const resolved = explicitTarget ?? (typeof document !== 'undefined' ? document : null);
      if (resolved === null) return;
      started = true;
      bound = resolved;
      bound.addEventListener('keydown', handler);
    },
    stop() {
      if (!started) return;
      started = false;
      bound?.removeEventListener('keydown', handler);
      bound = null;
      matcher.cancel();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    openCheatsheet() {
      if (!cheatsheetVisible) {
        cheatsheetVisible = true;
        emit();
      }
    },
    closeCheatsheet() {
      if (cheatsheetVisible) {
        cheatsheetVisible = false;
        emit();
      }
    },
    toggleCheatsheet,
    cancel() {
      matcher.cancel();
    },
    getCheatsheetModel() {
      return buildCheatsheetModel(registry, cmp);
    },
  };
  return engine;
};
