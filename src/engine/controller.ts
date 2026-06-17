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

export type WhichKeyEngine = {
  register(keys: string, handler: ShortcutHandler, options?: ShortcutOptions): () => void;
  registerGroup(prefix: string, options: { description: string; priority?: number }): () => void;
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
  const { timeoutMs = 500, helpKey = '?', sortKeys, target = document } = options;
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
    onFire: (entry, event) => entry.handler(event),
    onShowPopup: (state) => {
      popupVisible = true;
      currentSequence = state.currentSequence;
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
    });
  }

  const handler = (event: Event) => matcher.handleKeyDown(event as KeyboardEvent);

  return {
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
      };
      registry.register(entry);
      return () => registry.unregister(id);
    },
    registerGroup(prefix, opts) {
      const id = `wkg_${idCounter++}`;
      registry.registerGroup({ id, prefix, description: opts.description, priority: opts.priority ?? 0 });
      return () => registry.unregisterGroup(id);
    },
    start() {
      if (started) return;
      started = true;
      target.addEventListener('keydown', handler);
    },
    stop() {
      if (!started) return;
      started = false;
      target.removeEventListener('keydown', handler);
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
};
