import type { ShortcutEntry, GroupEntry, WhichKeyCandidate } from './types';

export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutEntry[]>();
  private groups = new Map<string, GroupEntry[]>();
  private layers = new Map<string, { level: number; exclusive: boolean }>();

  activateLayer(id: string, level: number, exclusive: boolean): void {
    this.layers.set(id, { level, exclusive });
  }

  deactivateLayer(id: string): void {
    this.layers.delete(id);
  }

  nextLevel(): number {
    let max = 0;
    for (const { level } of this.layers.values()) if (level > max) max = level;
    return max + 1;
  }

  private blockLevel(): number {
    let block = 0;
    for (const { level, exclusive } of this.layers.values()) {
      if (exclusive && level > block) block = level;
    }
    return block;
  }

  private isReachable(entry: { level: number; global: boolean }, block: number): boolean {
    return entry.global || entry.level >= block;
  }

  register(entry: ShortcutEntry): void {
    const bucket = this.shortcuts.get(entry.keys) ?? [];
    if (bucket.length > 0) {
      const top = this.findActive(bucket);
      const topDesc = top?.description ?? '(no description)';
      console.warn(
        `[whichkey] Shortcut "${entry.keys}" registered while another is active. ` +
          `Existing top: "${topDesc}". Stacking; new registration takes precedence until unmount.`,
      );
    }
    const insertIndex = bucket.findIndex((e) => e.priority > entry.priority);
    bucket.splice(insertIndex === -1 ? bucket.length : insertIndex, 0, entry);
    this.shortcuts.set(entry.keys, bucket);
  }

  unregister(id: string): void {
    for (const [keys, bucket] of this.shortcuts) {
      const idx = bucket.findIndex((e) => e.id === id);
      if (idx >= 0) {
        bucket.splice(idx, 1);
        if (bucket.length === 0) this.shortcuts.delete(keys);
        return;
      }
    }
  }

  registerGroup(entry: GroupEntry): void {
    const bucket = this.groups.get(entry.prefix) ?? [];
    const insertIndex = bucket.findIndex((e) => e.priority > entry.priority);
    bucket.splice(insertIndex === -1 ? bucket.length : insertIndex, 0, entry);
    this.groups.set(entry.prefix, bucket);
  }

  unregisterGroup(id: string): void {
    for (const [prefix, bucket] of this.groups) {
      const idx = bucket.findIndex((e) => e.id === id);
      if (idx >= 0) {
        bucket.splice(idx, 1);
        if (bucket.length === 0) this.groups.delete(prefix);
        return;
      }
    }
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
    const seen = new Map<string, WhichKeyCandidate>();
    for (const [keys, bucket] of this.shortcuts) {
      if (!keys.startsWith(prefixWithSpace)) continue;
      const top = this.findActive(bucket);
      if (!top) continue;
      const remainder = keys.slice(prefixWithSpace.length);
      const firstSpace = remainder.indexOf(' ');
      const isGroup = firstSpace >= 0;
      const nextKey = isGroup ? remainder.slice(0, firstSpace) : remainder;
      const subPrefix = prefix + ' ' + nextKey;
      const candidateKey = isGroup ? subPrefix : keys;
      if (seen.has(candidateKey)) continue;
      const description = isGroup ? this.getActiveGroup(subPrefix)?.description : top.description;
      seen.set(candidateKey, {
        keys: candidateKey,
        nextKey,
        description,
        isGroup,
      });
    }
    return Array.from(seen.values());
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
