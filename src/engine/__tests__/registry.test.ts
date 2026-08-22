import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShortcutRegistry } from '../registry';
import type { ShortcutEntry, GroupEntry } from '../types';

const entry = (overrides: Partial<ShortcutEntry> = {}): ShortcutEntry => ({
  id: overrides.id ?? `id-${Math.random()}`,
  keys: 'g n',
  handler: () => {},
  description: undefined,
  enableOnInputs: false,
  priority: 0,
  enabled: true,
  level: 0,
  global: false,
  ...overrides,
});

describe('ShortcutRegistry — register/unregister/getActive', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('returns undefined for unregistered keys', () => {
    const r = new ShortcutRegistry();
    expect(r.getActive('g n')).toBeUndefined();
  });

  it('returns the registered entry as active', () => {
    const r = new ShortcutRegistry();
    const e = entry({ id: '1' });
    r.register(e);
    expect(r.getActive('g n')).toBe(e);
  });

  it('LIFO: later registration becomes active', () => {
    const r = new ShortcutRegistry();
    const a = entry({ id: 'a', description: 'first' });
    const b = entry({ id: 'b', description: 'second' });
    r.register(a);
    r.register(b);
    expect(r.getActive('g n')).toBe(b);
  });

  it('unregister(top) restores previous entry', () => {
    const r = new ShortcutRegistry();
    const a = entry({ id: 'a' });
    const b = entry({ id: 'b' });
    r.register(a);
    r.register(b);
    r.unregister('b');
    expect(r.getActive('g n')).toBe(a);
  });

  it('unregister(non-top) keeps top active', () => {
    const r = new ShortcutRegistry();
    const a = entry({ id: 'a' });
    const b = entry({ id: 'b' });
    r.register(a);
    r.register(b);
    r.unregister('a');
    expect(r.getActive('g n')).toBe(b);
  });

  it('higher priority entry is active even when registered first', () => {
    const r = new ShortcutRegistry();
    const high = entry({ id: 'high', priority: 100 });
    const low = entry({ id: 'low', priority: 0 });
    r.register(high);
    r.register(low);
    expect(r.getActive('g n')).toBe(high);
  });

  it('warns on stack collision with existing top description', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'a', description: 'Focus Notes' }));
    r.register(entry({ id: 'b', description: 'Other' }));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Shortcut "g n" has a same-level collision'),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Focus Notes'));
  });

  it('does not warn on first registration of a key', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'a' }));
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips disabled entries — the next-most-recent enabled wins', () => {
    const r = new ShortcutRegistry();
    const a = entry({ id: 'a' });
    const b = entry({ id: 'b', enabled: false });
    r.register(a);
    r.register(b);
    expect(r.getActive('g n')).toBe(a);
  });

  it('getActive uses canonical key string match (no normalization here)', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'a', keys: 'Ctrl+K' }));
    expect(r.getActive('Ctrl+K')).toBeDefined();
    expect(r.getActive('ctrl+k')).toBeUndefined();
  });
});

const groupEntry = (overrides: Partial<GroupEntry> = {}): GroupEntry => ({
  id: overrides.id ?? `g-${Math.random()}`,
  prefix: 'g',
  description: 'Focus widget',
  priority: 0,
  level: 0,
  ...overrides,
});

describe('ShortcutRegistry — groups', () => {
  it('returns undefined for unregistered group', () => {
    const r = new ShortcutRegistry();
    expect(r.getActiveGroup('g')).toBeUndefined();
  });

  it('returns the registered group', () => {
    const r = new ShortcutRegistry();
    const g = groupEntry({ id: 'g1' });
    r.registerGroup(g);
    expect(r.getActiveGroup('g')).toBe(g);
  });

  it('LIFO for groups too', () => {
    const r = new ShortcutRegistry();
    const a = groupEntry({ id: 'a', description: 'first' });
    const b = groupEntry({ id: 'b', description: 'second' });
    r.registerGroup(a);
    r.registerGroup(b);
    expect(r.getActiveGroup('g')).toBe(b);
  });

  it('unregisterGroup restores previous', () => {
    const r = new ShortcutRegistry();
    const a = groupEntry({ id: 'a', description: 'first' });
    const b = groupEntry({ id: 'b', description: 'second' });
    r.registerGroup(a);
    r.registerGroup(b);
    r.unregisterGroup('b');
    expect(r.getActiveGroup('g')).toBe(a);
  });
});

describe('ShortcutRegistry — getActiveCandidates', () => {
  it('returns leaf candidates directly under prefix', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'g n', description: 'Notes' }));
    r.register(entry({ id: '2', keys: 'g s', description: 'Skills' }));
    const cs = r.getActiveCandidates('g');
    expect(cs).toHaveLength(2);
    expect(cs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nextKey: 'n',
          isGroup: false,
          description: 'Notes',
          keys: 'g n',
        }),
        expect.objectContaining({
          nextKey: 's',
          isGroup: false,
          description: 'Skills',
          keys: 'g s',
        }),
      ]),
    );
  });

  it('represents deeper sequences as a single group candidate', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'g f n', description: 'Feats Notes' }));
    r.register(entry({ id: '2', keys: 'g f s', description: 'Feats Skills' }));
    const cs = r.getActiveCandidates('g');
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ nextKey: 'f', isGroup: true, keys: 'g f' });
  });

  it('uses the registered group description for sub-group candidates', () => {
    const r = new ShortcutRegistry();
    r.registerGroup(groupEntry({ id: 'gf', prefix: 'g f', description: 'Fancy stuff' }));
    r.register(entry({ id: '1', keys: 'g f n' }));
    const cs = r.getActiveCandidates('g');
    expect(cs[0]).toMatchObject({ nextKey: 'f', isGroup: true, description: 'Fancy stuff' });
  });

  it('returns empty array when no shortcuts match prefix', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'g n' }));
    expect(r.getActiveCandidates('x')).toEqual([]);
  });

  it('returns empty array when prefix exactly equals a leaf (no continuations)', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'g' }));
    expect(r.getActiveCandidates('g')).toEqual([]);
  });

  it('honors LIFO override — a stacked-on-top entry replaces the previous candidate', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'a', keys: 'g n', description: 'Old Notes' }));
    r.register(entry({ id: 'b', keys: 'g n', description: 'New Notes' }));
    const cs = r.getActiveCandidates('g');
    expect(cs).toHaveLength(1);
    expect(cs[0].description).toBe('New Notes');
  });
});

describe('ShortcutRegistry.getActiveCandidates — leaf/deeper collisions [B20]', () => {
  const build = (order: Array<[string, string]>) => {
    const registry = new ShortcutRegistry();
    order.forEach(([keys, description], i) =>
      registry.register(entry({ id: `e${i}`, keys, description })),
    );
    return registry;
  };

  it('emits one merged group candidate regardless of registration order', () => {
    const forward = build([
      ['g h', 'Leaf label'],
      ['g h i', 'Deeper'],
    ]);
    const reverse = build([
      ['g h i', 'Deeper'],
      ['g h', 'Leaf label'],
    ]);

    for (const registry of [forward, reverse]) {
      const candidates = registry.getActiveCandidates('g');
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toEqual({
        keys: 'g h',
        nextKey: 'h',
        description: 'Leaf label',
        isGroup: true,
      });
    }
  });

  it('prefers a registered group label over the leaf description', () => {
    const registry = build([
      ['g h', 'Leaf label'],
      ['g h i', 'Deeper'],
    ]);
    registry.registerGroup(groupEntry({ id: 'grp', prefix: 'g h', description: 'Group label' }));
    expect(registry.getActiveCandidates('g')[0].description).toBe('Group label');
  });

  it('still emits a plain leaf candidate when no deeper sequence exists', () => {
    const registry = build([['g h', 'Leaf label']]);
    expect(registry.getActiveCandidates('g')).toEqual([
      { keys: 'g h', nextKey: 'h', description: 'Leaf label', isGroup: false },
    ]);
  });
});

describe('ShortcutRegistry — getAllActive', () => {
  it('returns one entry per registered key (the active one)', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'g n' }));
    r.register(entry({ id: '2', keys: 'g s' }));
    r.register(entry({ id: '3', keys: 'g n', description: 'override' }));
    const all = r.getAllActive();
    expect(all).toHaveLength(2);
    const descs = all.map((e) => e.description);
    expect(descs).toContain('override');
  });
});

// ---------------------------------------------------------------------------
// Layer tests — added for feat/keybinding-layers Task 1
// ---------------------------------------------------------------------------

const layerEntry = (
  over: Partial<ShortcutEntry> & { keys: string; id: string },
): ShortcutEntry => ({
  handler: () => {},
  description: undefined,
  enableOnInputs: false,
  priority: 0,
  enabled: true,
  level: 0,
  global: false,
  ...over,
});

describe('registry layers', () => {
  it('exclusive layer blocks lower-level entries', () => {
    const r = new ShortcutRegistry();
    r.register(layerEntry({ id: 'base', keys: 'a', level: 0 }));
    r.register(layerEntry({ id: 'modal', keys: 'b', level: 1 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('a')).toBeUndefined(); // base suppressed
    expect(r.getActive('b')?.id).toBe('modal'); // layer reachable
  });

  it('additive layer leaves lower entries reachable', () => {
    const r = new ShortcutRegistry();
    r.register(layerEntry({ id: 'base', keys: 'a', level: 0 }));
    r.activateLayer('L1', 1, false);
    expect(r.getActive('a')?.id).toBe('base');
  });

  it('global entry pierces an exclusive layer', () => {
    const r = new ShortcutRegistry();
    r.register(layerEntry({ id: 'help', keys: '?', level: 0, global: true }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('?')?.id).toBe('help');
  });

  it('a higher layer overrides a global key', () => {
    const r = new ShortcutRegistry();
    r.register(layerEntry({ id: 'help', keys: '?', level: 0, global: true }));
    r.register(layerEntry({ id: 'modalHelp', keys: '?', level: 1 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('?')?.id).toBe('modalHelp'); // (level,priority,index): level 1 wins
  });

  it('deactivateLayer re-reveals the layer beneath', () => {
    const r = new ShortcutRegistry();
    r.register(layerEntry({ id: 'base', keys: 'a', level: 0 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActive('a')).toBeUndefined();
    r.deactivateLayer('L1');
    expect(r.getActive('a')?.id).toBe('base');
  });

  it('nextLevel is max active level + 1', () => {
    const r = new ShortcutRegistry();
    expect(r.nextLevel()).toBe(1);
    r.activateLayer('L1', 1, false);
    expect(r.nextLevel()).toBe(2);
  });

  it('candidates and cheatsheet exclude suppressed entries', () => {
    const r = new ShortcutRegistry();
    r.register(layerEntry({ id: 'g-d', keys: 'g d', level: 0 }));
    r.register(layerEntry({ id: 'm', keys: 'g x', level: 1 }));
    r.activateLayer('L1', 1, true);
    expect(r.getActiveCandidates('g').map((c) => c.keys)).toEqual(['g x']);
    expect(r.getAllActive().map((e) => e.id)).toEqual(['m']);
  });
});

describe('ShortcutRegistry.blockLevel caching [B19]', () => {
  it('reflects a layer activated after an earlier lookup', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'base', keys: 'z', level: 0 }));
    expect(registry.getActive('z')).toBeDefined();

    registry.activateLayer('modal', 1, true);
    expect(registry.getActive('z')).toBeUndefined();

    registry.deactivateLayer('modal');
    expect(registry.getActive('z')).toBeDefined();
  });

  it('reflects a layer whose exclusivity changes under the same id', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'base', keys: 'z', level: 0 }));
    registry.activateLayer('l', 1, false);
    expect(registry.getActive('z')).toBeDefined();

    registry.activateLayer('l', 1, true);
    expect(registry.getActive('z')).toBeUndefined();
  });
});

describe('hasCandidates', () => {
  const build = () => new ShortcutRegistry();

  it('agrees with getActiveCandidates across leaf, group, mixed and empty prefixes', () => {
    const r = build();
    r.register(entry({ id: '1', keys: 'g a' }));
    r.register(entry({ id: '2', keys: 'g b c' }));
    r.register(entry({ id: '3', keys: 'z' }));
    for (const prefix of ['g', 'g b', 'z', 'nope', '']) {
      expect(r.hasCandidates(prefix)).toBe(r.getActiveCandidates(prefix).length > 0);
    }
  });

  it('returns false when the only matching entry is disabled', () => {
    const r = build();
    r.register(entry({ id: '1', keys: 'g a', enabled: false }));
    expect(r.hasCandidates('g')).toBe(false);
    expect(r.getActiveCandidates('g').length).toBe(0);
  });

  it('returns false when the only matching entry is blocked by an exclusive layer', () => {
    const r = build();
    r.register(entry({ id: '1', keys: 'g a', level: 0 }));
    r.activateLayer('L', 1, true);
    expect(r.hasCandidates('g')).toBe(false);
    expect(r.getActiveCandidates('g').length).toBe(0);
  });
});

describe('collision warning precision', () => {
  it('stays silent when an exclusive layer makes the existing entry unreachable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'Escape', level: 0, description: 'page escape' }));
    r.activateLayer('L', 1, true);
    r.register(entry({ id: '2', keys: 'Escape', level: 1, description: 'Close' }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays silent when the only existing entry is disabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'x', enabled: false }));
    r.register(entry({ id: '2', keys: 'x' }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and names the real winner on a same-level collision', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'x', priority: 5, description: 'Winner' }));
    r.register(entry({ id: '2', keys: 'x', priority: 0, description: 'Loser' }));
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain('"x"');
    expect(msg).toContain('Winner');
    warn.mockRestore();
  });

  // This fixture (lower priority registered first, higher priority second)
  // is deliberately chosen so the pre-insertion "top" and the post-insertion
  // winner are two different entries. A regression that computed the winner
  // before the splice (the pre-task behavior) would name the incumbent
  // ("Incumbent") as the sole party and never mention "Override" at all, so
  // this asserts the winner-then-"wins over"-then-loser shape specifically,
  // not just substring presence.
  it('names the true post-insertion winner even when it differs from the pre-insertion incumbent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'x', priority: 0, description: 'Incumbent' }));
    r.register(entry({ id: '2', keys: 'x', priority: 5, description: 'Override' }));
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toMatch(/"Override".*wins over.*"Incumbent"/);
    warn.mockRestore();
  });
});

describe('ShortcutRegistry.version [D1]', () => {
  it('starts at 0 and increments on every mutation', () => {
    const registry = new ShortcutRegistry();
    expect(registry.version).toBe(0);

    registry.register(entry({ id: 'a', keys: 'a' }));
    const afterRegister = registry.version;
    expect(afterRegister).toBeGreaterThan(0);

    registry.registerGroup({ id: 'g', prefix: 'g', description: 'Go', priority: 0, level: 0 });
    expect(registry.version).toBeGreaterThan(afterRegister);

    const afterGroup = registry.version;
    registry.activateLayer('l', 1, true);
    expect(registry.version).toBeGreaterThan(afterGroup);

    const afterActivate = registry.version;
    registry.deactivateLayer('l');
    expect(registry.version).toBeGreaterThan(afterActivate);

    const afterDeactivate = registry.version;
    registry.unregisterGroup('g');
    expect(registry.version).toBeGreaterThan(afterDeactivate);

    const afterUnregisterGroup = registry.version;
    registry.unregister('a');
    expect(registry.version).toBeGreaterThan(afterUnregisterGroup);
  });

  it('does not change on reads', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'a', keys: 'a' }));
    const v = registry.version;
    registry.getActive('a');
    registry.getAllActive();
    registry.getActiveCandidates('a');
    registry.getActiveGroup('a');
    expect(registry.version).toBe(v);
  });
});

describe('ShortcutRegistry — priority-ordered insertion [T14]', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('inserts before the first strictly-higher-priority entry, so equal priorities stay in registration order', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'lo', keys: 'x', priority: 0 }));
    registry.register(entry({ id: 'hi', keys: 'x', priority: 5 }));
    registry.register(entry({ id: 'mid', keys: 'x', priority: 0 }));
    expect(registry.getActive('x')?.id).toBe('hi');
    registry.unregister('hi');
    expect(registry.getActive('x')?.id).toBe('mid');
    registry.unregister('mid');
    expect(registry.getActive('x')?.id).toBe('lo');
  });
});

describe('registry resolution cascade — characterization [T15]', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('findActive: a higher level beats a higher priority', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'low', keys: 'x', level: 0, priority: 99 }));
    r.register(entry({ id: 'high', keys: 'x', level: 1, priority: 0 }));
    expect(r.getActive('x')?.id).toBe('high');
  });

  it('findActive: at equal level, the higher priority wins', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'p9', keys: 'x', level: 1, priority: 9 }));
    r.register(entry({ id: 'p1', keys: 'x', level: 1, priority: 1 }));
    expect(r.getActive('x')?.id).toBe('p9');
  });

  it('findActive: at equal level and priority, the later registration wins', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'first', keys: 'x', level: 1, priority: 1 }));
    r.register(entry({ id: 'second', keys: 'x', level: 1, priority: 1 }));
    expect(r.getActive('x')?.id).toBe('second');
  });

  it('findActive: a disabled entry is skipped even when it would win the cascade', () => {
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'live', keys: 'x', level: 0, priority: 0 }));
    r.register(entry({ id: 'dead', keys: 'x', level: 5, priority: 9, enabled: false }));
    expect(r.getActive('x')?.id).toBe('live');
  });

  it('getActiveGroup: runs the same level -> priority -> latest cascade', () => {
    const byLevel = new ShortcutRegistry();
    byLevel.registerGroup({ id: 'a', prefix: 'g', description: 'a', priority: 9, level: 0 });
    byLevel.registerGroup({ id: 'b', prefix: 'g', description: 'b', priority: 0, level: 1 });
    expect(byLevel.getActiveGroup('g')?.id).toBe('b');

    const byPriority = new ShortcutRegistry();
    byPriority.registerGroup({ id: 'a', prefix: 'g', description: 'a', priority: 1, level: 1 });
    byPriority.registerGroup({ id: 'b', prefix: 'g', description: 'b', priority: 9, level: 1 });
    expect(byPriority.getActiveGroup('g')?.id).toBe('b');

    const byRecency = new ShortcutRegistry();
    byRecency.registerGroup({ id: 'a', prefix: 'g', description: 'a', priority: 1, level: 1 });
    byRecency.registerGroup({ id: 'b', prefix: 'g', description: 'b', priority: 1, level: 1 });
    expect(byRecency.getActiveGroup('g')?.id).toBe('b');
  });

  it('a global shortcut escapes an exclusive layer but a group at the same level cannot [T30 — deliberately unfixed]', () => {
    // The two eligibility predicates are NOT interchangeable: GroupEntry has
    // no `global` field, so there is no group-side escape hatch. Any future
    // unification of the cascade must keep this test red-if-changed.
    const r = new ShortcutRegistry();
    r.register(entry({ id: 'esc', keys: 'g', level: 0, global: true }));
    r.registerGroup({ id: 'grp', prefix: 'g', description: 'Go', priority: 0, level: 0 });
    r.activateLayer('modal', 1, true);
    expect(r.getActive('g')?.id).toBe('esc');
    expect(r.getActiveGroup('g')).toBeUndefined();
  });
});

describe('ShortcutRegistry.version — a no-op unregister is not a mutation [T29]', () => {
  it('does not bump version when unregister removes nothing', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'a', keys: 'a' }));
    registry.unregister('a');
    const v = registry.version;
    registry.unregister('a');
    registry.unregister('never-registered');
    expect(registry.version).toBe(v);
  });

  it('does not bump version when unregisterGroup removes nothing', () => {
    const registry = new ShortcutRegistry();
    registry.registerGroup({ id: 'g', prefix: 'g', description: 'Go', priority: 0, level: 0 });
    registry.unregisterGroup('g');
    const v = registry.version;
    registry.unregisterGroup('g');
    registry.unregisterGroup('never-registered');
    expect(registry.version).toBe(v);
  });
});
