import type { ShortcutEntry, GroupEntry, WhichKeyCandidate } from './types';

// Both buckets keep entries in ascending priority order, inserting BEFORE the
// first strictly-higher-priority entry. That insertion point is what makes
// "latest registration wins at equal priority" true, because findActive and
// getActiveGroup tiebreak on bucket index. Shared so the shortcut and group
// paths cannot drift apart.
const insertByPriority = <T extends { priority: number }>(
  map: Map<string, T[]>,
  key: string,
  entry: T,
): void => {
  const bucket = map.get(key) ?? [];
  const insertIndex = bucket.findIndex((e) => e.priority > entry.priority);
  bucket.splice(insertIndex === -1 ? bucket.length : insertIndex, 0, entry);
  map.set(key, bucket);
};

// Returns whether an entry was actually removed, so a caller can avoid
// bumping a mutation counter for an unregister that found nothing.
const removeById = <T extends { id: string }>(map: Map<string, T[]>, id: string): boolean => {
  for (const [key, bucket] of map) {
    const idx = bucket.findIndex((e) => e.id === id);
    if (idx >= 0) {
      bucket.splice(idx, 1);
      if (bucket.length === 0) map.delete(key);
      return true;
    }
  }
  return false;
};

/**
 * Stores every registration in priority-sorted buckets keyed by canonical key
 * string (and by group prefix), so several components can bind the same key at
 * once.
 *
 * A bucket's winner is resolved by level, then priority, then latest
 * registration. An active `exclusive` layer raises a reachability floor: an
 * entry below its level is unreachable unless it was registered with
 * `global: true`.
 *
 * Exported for diagnostics, where `getAllActive()` is the supported read. The
 * mutators are driven by the engine — calling them directly bypasses its
 * bookkeeping.
 */
export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutEntry[]>();
  private groups = new Map<string, GroupEntry[]>();
  private layers = new Map<string, { level: number; exclusive: boolean }>();
  // blockLevel() is invariant between layer mutations but is called once per
  // bucket from findActive/getActiveGroup — so a single getAllActive() over N
  // keys used to cost N full layer scans. activateLayer and deactivateLayer
  // are the only two writers of `layers`, so nulling here is exhaustive.
  private blockLevelCache: number | null = null;

  // Monotonic, bumped by every mutator. Lets a consumer memoise derived views
  // (the React cheatsheet rebuilds a full scan + bucketing + sorts otherwise)
  // without making them stale: unlike keying on "is the sheet open", a late
  // registration still invalidates. Public because ShortcutRegistry is an
  // exported class — see docs/API.md.
  private _version = 0;

  /**
   * Monotonic mutation counter, starting at `0`. Bumped by every registration,
   * unregistration, and layer activation or deactivation, and never by a read.
   * Intended as a memoisation key for a derived view over the registry.
   */
  get version(): number {
    return this._version;
  }

  activateLayer(id: string, level: number, exclusive: boolean): void {
    this._version++;
    this.layers.set(id, { level, exclusive });
    this.blockLevelCache = null;
  }

  deactivateLayer(id: string): void {
    this._version++;
    this.layers.delete(id);
    this.blockLevelCache = null;
  }

  nextLevel(): number {
    let max = 0;
    for (const { level } of this.layers.values()) if (level > max) max = level;
    return max + 1;
  }

  private blockLevel(): number {
    if (this.blockLevelCache !== null) return this.blockLevelCache;
    let block = 0;
    for (const { level, exclusive } of this.layers.values()) {
      if (exclusive && level > block) block = level;
    }
    this.blockLevelCache = block;
    return block;
  }

  private isReachable(entry: { level: number; global: boolean }, block: number): boolean {
    return entry.global || entry.level >= block;
  }

  register(entry: ShortcutEntry): void {
    this._version++;
    insertByPriority(this.shortcuts, entry.keys, entry);
    // insertByPriority always leaves a bucket behind for this key; the `?? []`
    // only satisfies Map.get's `| undefined`.
    const bucket = this.shortcuts.get(entry.keys) ?? [];

    // Only a genuine same-level collision is worth warning about: a different
    // level is the documented, deliberate layer-override mechanism, and a
    // sole disabled/unreachable incumbent isn't a competitor at all. Detect a
    // genuine collision by checking for another *live* entry at this entry's
    // own level, independent of which one findActive ends up crowning.
    const block = this.blockLevel();
    const rival = bucket.find(
      (e) =>
        e.id !== entry.id && e.level === entry.level && e.enabled && this.isReachable(e, block),
    );
    if (rival !== undefined) {
      const winner = this.findActive(bucket);
      if (winner !== undefined && winner.level === entry.level) {
        const loser = winner.id === entry.id ? rival : entry;
        console.warn(
          `[whichkey] Shortcut "${entry.keys}" has a same-level collision: ` +
            `"${winner.description ?? '(no description)'}" (level ${winner.level}, priority ${winner.priority}) ` +
            `wins over "${loser.description ?? '(no description)'}" (level ${loser.level}, priority ${loser.priority}). ` +
            `Raise the losing entry's priority or unregister one to resolve.`,
        );
      }
    }
  }

  unregister(id: string): void {
    this._version++;
    removeById(this.shortcuts, id);
  }

  registerGroup(entry: GroupEntry): void {
    this._version++;
    insertByPriority(this.groups, entry.prefix, entry);
  }

  unregisterGroup(id: string): void {
    this._version++;
    removeById(this.groups, id);
  }

  getActive(keys: string): ShortcutEntry | undefined {
    const bucket = this.shortcuts.get(keys);
    if (!bucket) return undefined;
    return this.findActive(bucket);
  }

  getActiveGroup(prefix: string): GroupEntry | undefined {
    const bucket = this.groups.get(prefix);
    if (!bucket || bucket.length === 0) return undefined;
    const block = this.blockLevel();
    let best: GroupEntry | undefined;
    let bestIdx = -1;
    for (let i = 0; i < bucket.length; i++) {
      const g = bucket[i];
      if (g.level < block) continue;
      if (
        best === undefined ||
        g.level > best.level ||
        (g.level === best.level && g.priority > best.priority) ||
        (g.level === best.level && g.priority === best.priority && i > bestIdx)
      ) {
        best = g;
        bestIdx = i;
      }
    }
    return best;
  }

  /**
   * Every shortcut currently winning its bucket — what would actually fire
   * right now, once level, priority, and layer blocking are resolved. The array
   * is freshly built, but the entries are the live registration objects.
   */
  getAllActive(): ShortcutEntry[] {
    const out: ShortcutEntry[] = [];
    for (const bucket of this.shortcuts.values()) {
      const top = this.findActive(bucket);
      if (top) out.push(top);
    }
    return out;
  }

  getActiveCandidates(prefix: string): WhichKeyCandidate[] {
    const prefixWithSpace = prefix + ' ';
    // Keyed by nextKey alone. A leaf `g h` and a deeper `g h i` are the SAME
    // row in the popup — the user presses one key. Keying by the full key
    // string for leaves but by the sub-prefix for deeper sequences made the
    // two collide on 'g h' and silently dropped whichever registered second,
    // so the output depended on registration order.
    const seen = new Map<string, WhichKeyCandidate>();
    for (const [keys, bucket] of this.shortcuts) {
      if (!keys.startsWith(prefixWithSpace)) continue;
      const top = this.findActive(bucket);
      if (!top) continue;
      const remainder = keys.slice(prefixWithSpace.length);
      const firstSpace = remainder.indexOf(' ');
      const isGroup = firstSpace >= 0;
      const nextKey = isGroup ? remainder.slice(0, firstSpace) : remainder;
      const subPrefix = prefixWithSpace + nextKey;
      const existing = seen.get(nextKey);
      // Merge rather than skip: once ANY deeper continuation exists for this
      // nextKey the row is a group. `top.description` only ever describes the
      // exact leaf at `subPrefix` (this iteration's own `keys`) — for a
      // deeper continuation (isGroup) `top` is the entry at the LONGER key,
      // whose description belongs to that longer key, not this row, so it
      // must never be used as a filler here (doing so made the result
      // order-dependent again: whichever entry got processed first would
      // plant its own description as a false stand-in for the group's).
      // The fallback chain is: the registered group label, then whatever
      // real leaf description this row already picked up (from either
      // order), then — only when THIS entry is itself the exact leaf — its
      // own description.
      const groupDescription = this.getActiveGroup(subPrefix)?.description;
      seen.set(nextKey, {
        keys: subPrefix,
        nextKey,
        description: isGroup
          ? (groupDescription ?? existing?.description)
          : (groupDescription ?? existing?.description ?? top.description),
        isGroup: isGroup || (existing?.isGroup ?? false),
      });
    }
    return Array.from(seen.values());
  }

  /**
   * Cheap existence check for `getActiveCandidates(prefix).length > 0`.
   * Runs on every keystroke, so it allocates nothing and exits on the first hit.
   */
  hasCandidates(prefix: string): boolean {
    const prefixWithSpace = prefix + ' ';
    for (const [keys, bucket] of this.shortcuts) {
      if (!keys.startsWith(prefixWithSpace)) continue;
      if (this.findActive(bucket) !== undefined) return true;
    }
    return false;
  }

  private findActive(bucket: ShortcutEntry[]): ShortcutEntry | undefined {
    const block = this.blockLevel();
    let best: ShortcutEntry | undefined;
    let bestIdx = -1;
    for (let i = 0; i < bucket.length; i++) {
      const e = bucket[i];
      if (!e.enabled || !this.isReachable(e, block)) continue;
      if (
        best === undefined ||
        e.level > best.level ||
        (e.level === best.level && e.priority > best.priority) ||
        (e.level === best.level && e.priority === best.priority && i > bestIdx)
      ) {
        best = e;
        bestIdx = i;
      }
    }
    return best;
  }
}
