import { describe, it, expectTypeOf } from 'vitest';
import type {
  ShortcutHandler,
  ShortcutOptions,
  ShortcutEntry,
  GroupEntry,
  WhichKeyCandidate,
  WhichKeyState,
  CanonicalKey,
} from '../types';

describe('whichkey types', () => {
  it('ShortcutHandler accepts a KeyboardEvent', () => {
    expectTypeOf<ShortcutHandler>().parameters.toEqualTypeOf<[KeyboardEvent]>();
  });

  it('ShortcutEntry has expected fields', () => {
    expectTypeOf<ShortcutEntry>().toMatchTypeOf<{
      id: string;
      keys: string;
      handler: ShortcutHandler;
      description: string | undefined;
      enableOnInputs: boolean;
      priority: number;
      enabled: boolean;
    }>();
  });

  it('GroupEntry has expected fields', () => {
    expectTypeOf<GroupEntry>().toMatchTypeOf<{
      id: string;
      prefix: string;
      description: string;
      priority: number;
    }>();
  });

  it('WhichKeyCandidate exposes nextKey and description', () => {
    expectTypeOf<WhichKeyCandidate>().toMatchTypeOf<{
      keys: string;
      nextKey: string;
      description: string | undefined;
      isGroup: boolean;
    }>();
  });

  it('WhichKeyState has visible flag and cancel function', () => {
    expectTypeOf<WhichKeyState>().toMatchTypeOf<{
      visible: boolean;
      currentSequence: readonly string[];
      candidates: readonly WhichKeyCandidate[];
      cancel: () => void;
    }>();
  });

  it('ShortcutOptions are all optional', () => {
    const opts: ShortcutOptions = {};
    expect(opts).toBeDefined();
  });

  it('CanonicalKey is a string alias', () => {
    const k: CanonicalKey = 'g';
    expect(typeof k).toBe('string');
  });
});
