import type { KeyComparator, SortMode } from './types';

/**
 * Vim-style alphabetical comparator: case-insensitive primary sort,
 * lowercase before uppercase as the tiebreak. So `a` < `A` < `b` < `B`.
 *
 * Works on full canonical key strings (e.g. `'g a'` < `'g A'` < `'g b'`).
 */
export const alphabeticalKeysSort: KeyComparator = (a, b) => {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al < bl) return -1;
  if (al > bl) return 1;
  if (a === b) return 0;
  // Same letters case-insensitive — lowercase first.
  return a > b ? -1 : 1;
};

/**
 * Resolve a SortMode to a concrete comparator (or undefined for "no sort").
 */
export const resolveSort = (mode: SortMode | undefined): KeyComparator | undefined => {
  if (mode === undefined || mode === 'registration') return undefined;
  if (mode === 'alphabetical') return alphabeticalKeysSort;
  return mode;
};
