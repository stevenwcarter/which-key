import type { ShortcutEntry, GroupEntry, WhichKeyCandidate } from './types';

export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutEntry[]>();
  private groups = new Map<string, GroupEntry[]>();

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
    return bucket[bucket.length - 1];
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
    for (let i = bucket.length - 1; i >= 0; i--) {
      if (bucket[i].enabled) return bucket[i];
    }
    return undefined;
  }
}
