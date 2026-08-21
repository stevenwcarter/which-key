import { ShortcutRegistry } from './registry';
import { Matcher } from './matcher';
import { parseKey, parseSequence } from './keys';
import { resolveSort } from './sort';
import type {
  KeyComparator, ShortcutHandler, ShortcutOptions, ShortcutEntry, WhichKeyCandidate, SortMode,
} from './types';

const DEFAULT_HELP_ID = '__whichkey_default_help__';

export type WhichKeyOptions = {
  timeoutMs?: number;
  helpKey?: string | null;
  sortKeys?: SortMode;
  target?: Document | HTMLElement;
};

export type CheatsheetEntry = { keys: string; description: string | undefined };
export type CheatsheetGroup = { prefix: string; description: string | undefined; entries: CheatsheetEntry[] };
export type CheatsheetModel = { standalone: CheatsheetEntry[]; groups: CheatsheetGroup[] };

export type WhichKeySnapshot = {
  popup: { visible: boolean; currentSequence: string[]; candidates: WhichKeyCandidate[] };
  cheatsheet: { visible: boolean };
};

export type LayerHandle = {
  readonly level: number;
  register: WhichKeyEngine['register'];
  registerGroup: WhichKeyEngine['registerGroup'];
  pop(): void;
};

export type WhichKeyEngine = {
  register(keys: string, handler: ShortcutHandler, options?: ShortcutOptions): () => void;
  registerGroup(prefix: string, options: { description: string; priority?: number; level?: number }): () => void;
  activateLayer(level: number, exclusive: boolean): () => void;
  pushLayer(options?: { exclusive?: boolean; level?: number }): LayerHandle;
  start(): void;
  stop(): void;
  subscribe(listener: (snapshot: WhichKeySnapshot) => void): () => void;
  getSnapshot(): WhichKeySnapshot;
  openCheatsheet(): void;
  closeCheatsheet(): void;
  toggleCheatsheet(): void;
  cancel(): void;
  getCheatsheetModel(): CheatsheetModel;
  readonly registry: ShortcutRegistry;
};

const buildCheatsheetModel = (
  registry: ShortcutRegistry,
  cmp: KeyComparator | undefined,
): CheatsheetModel => {
  const all = registry.getAllActive().filter((e) => e.id !== DEFAULT_HELP_ID);
  const buckets = new Map<string, CheatsheetEntry[]>();
  for (const entry of all) {
    const first = entry.keys.split(' ')[0];
    const list = buckets.get(first) ?? [];
    list.push({ keys: entry.keys, description: entry.description });
    buckets.set(first, list);
  }
  const standalone: CheatsheetEntry[] = [];
  const groups: CheatsheetGroup[] = [];
  for (const [prefix, entries] of buckets) {
    if (entries.length === 1 && entries[0].keys === prefix) {
      standalone.push(entries[0]);
    } else {
      groups.push({ prefix, description: registry.getActiveGroup(prefix)?.description, entries });
    }
  }
  if (cmp) {
    standalone.sort((a, b) => cmp(a.keys, b.keys));
    for (const g of groups) g.entries.sort((a, b) => cmp(a.keys, b.keys));
    groups.sort((a, b) => cmp(a.prefix, b.prefix));
  }
  return { standalone, groups };
};

export const createWhichKey = (options: WhichKeyOptions = {}): WhichKeyEngine => {
  const { timeoutMs = 500, helpKey = '?', sortKeys } = options;
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
    for (const l of listeners) l(snapshot);
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
      popupVisible = false;
      currentSequence = [];
      emit();
    },
  });

  if (helpKey) {
    registry.register({
      id: DEFAULT_HELP_ID,
      keys: parseKey(helpKey),
      handler: () => toggleCheatsheet(),
      description: 'Toggle keyboard shortcuts',
      enableOnInputs: false,
      priority: -1,
      enabled: true,
      level: 0,
      global: true,
    });
  }

  const handler = (event: Event) => matcher.handleKeyDown(event as KeyboardEvent);

  const engine: WhichKeyEngine = {
    registry,
    register(keys, h, opts) {
      const id = `wk_${idCounter++}`;
      const entry: ShortcutEntry = {
        id,
        keys: parseSequence(keys).join(' '),
        handler: h,
        description: opts?.description,
        enableOnInputs: opts?.enableOnInputs ?? false,
        priority: opts?.priority ?? 0,
        enabled: opts?.enabled ?? true,
        level: opts?.level ?? 0,
        global: opts?.global ?? false,
      };
      registry.register(entry);
      return () => registry.unregister(id);
    },
    registerGroup(prefix, opts) {
      const id = `wkg_${idCounter++}`;
      registry.registerGroup({ id, prefix, description: opts.description, priority: opts.priority ?? 0, level: opts.level ?? 0 });
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
      const level = opts?.level ?? registry.nextLevel();
      const deactivate = engine.activateLayer(level, opts?.exclusive ?? false);
      const owned = new Set<() => void>();
      const track = (un: () => void): (() => void) => {
        const wrapped = () => { un(); owned.delete(wrapped); };
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
      return () => { listeners.delete(listener); };
    },
    getSnapshot() {
      return snapshot;
    },
    openCheatsheet() {
      if (!cheatsheetVisible) { cheatsheetVisible = true; emit(); }
    },
    closeCheatsheet() {
      if (cheatsheetVisible) { cheatsheetVisible = false; emit(); }
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
