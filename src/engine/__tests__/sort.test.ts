import { describe, it, expect } from 'vitest';
import { alphabeticalKeysSort, resolveSort } from '../sort';

describe('alphabeticalKeysSort', () => {
  it('sorts simple letters alphabetically', () => {
    const sorted = ['c', 'a', 'b'].sort(alphabeticalKeysSort);
    expect(sorted).toEqual(['a', 'b', 'c']);
  });

  it('sorts lowercase before uppercase for the same letter', () => {
    const sorted = ['A', 'a', 'B', 'b'].sort(alphabeticalKeysSort);
    expect(sorted).toEqual(['a', 'A', 'b', 'B']);
  });

  it('groups same letter together regardless of case', () => {
    const sorted = ['B', 'a', 'A', 'b', 'c', 'C'].sort(alphabeticalKeysSort);
    expect(sorted).toEqual(['a', 'A', 'b', 'B', 'c', 'C']);
  });

  it('sorts multi-segment keys lexicographically', () => {
    const sorted = ['g s', 'g a', 'g n'].sort(alphabeticalKeysSort);
    expect(sorted).toEqual(['g a', 'g n', 'g s']);
  });

  it('sorts /, digits, and letters in expected order', () => {
    const sorted = ['g s', 'g /', 'g 1', 'g a'].sort(alphabeticalKeysSort);
    // / and digits are punctuation/digits — the default lex order has '/' < '1' < 'a'
    expect(sorted).toEqual(['g /', 'g 1', 'g a', 'g s']);
  });

  it('returns 0 for identical strings', () => {
    expect(alphabeticalKeysSort('g a', 'g a')).toBe(0);
  });
});

describe('resolveSort', () => {
  it('returns undefined for "registration"', () => {
    expect(resolveSort('registration')).toBeUndefined();
  });

  it('returns undefined when mode is undefined', () => {
    expect(resolveSort(undefined)).toBeUndefined();
  });

  it('returns the alphabetical comparator for "alphabetical"', () => {
    const cmp = resolveSort('alphabetical');
    expect(cmp).toBeDefined();
    expect(cmp!('a', 'b')).toBeLessThan(0);
    expect(cmp!('a', 'A')).toBeLessThan(0);
  });

  it('returns the function passthrough for a custom comparator', () => {
    const reverse = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
    expect(resolveSort(reverse)).toBe(reverse);
  });
});
