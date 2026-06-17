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
      expect.stringContaining('Shortcut "g n" registered while another is active'),
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
