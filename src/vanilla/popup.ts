import type { WhichKeyCandidate, WhichKeySnapshot } from '../engine';
import { clamp01, clampRows } from '../shared/clamp';
import { SHORTCUTS_LABEL } from '../shared/strings';
import { el, kbd } from './dom';

/**
 * Fully-resolved popup renderer options. `mountWhichKey` fills in whatever its
 * caller left out of `MountOptions.popup`, so — unlike the React props — every
 * field here is required by the time the renderer sees it.
 */
export type PopupOptions = {
  layout: 'vertical' | 'horizontal';
  maxRows: number;
  backgroundOpacity: number;
};

const row = (p: string, c: WhichKeyCandidate): HTMLElement => {
  const r = el('div', c.isGroup ? `${p}-row ${p}-row--group` : `${p}-row`);
  r.appendChild(kbd(p, c.nextKey));
  const label = `${c.isGroup ? '+' : ''}${c.description ?? c.keys}`;
  r.appendChild(el('span', `${p}-row__label`, label));
  return r;
};

const sequence = (p: string, seq: readonly string[]): HTMLElement => {
  const wrap = el('div', `${p}-sequence`);
  wrap.dataset.testid = 'whichkey-popup-sequence';
  seq.forEach((k) => wrap.appendChild(kbd(p, k)));
  wrap.appendChild(el('span', `${p}-sequence__ellipsis`, '…'));
  return wrap;
};

export const renderPopup = (
  p: string,
  snap: WhichKeySnapshot,
  opts: PopupOptions,
): HTMLElement | null => {
  if (!snap.popup.visible) return null;
  const root = el('div', `${p}-popup ${p}-popup--${opts.layout}`);
  root.dataset.testid = 'whichkey-popup';
  root.dataset.layout = opts.layout;
  // The colour lives in src/styles.css (--wk-panel-bg-rgb), which follows
  // prefers-color-scheme / data-wk-theme; only the runtime opacity needs to
  // reach the element.
  root.style.setProperty('--wk-popup-bg-opacity', String(clamp01(opts.backgroundOpacity)));
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'true');
  root.setAttribute('aria-label', SHORTCUTS_LABEL);
  if (opts.layout === 'horizontal') {
    const body = el('div', `${p}-popup__body`);
    body.appendChild(sequence(p, snap.popup.currentSequence));
    const grid = el('div', `${p}-popup__grid`);
    grid.dataset.testid = 'whichkey-popup-grid';
    grid.style.gridTemplateRows = `repeat(${clampRows(opts.maxRows)}, auto)`;
    snap.popup.candidates.forEach((c) => grid.appendChild(row(p, c)));
    body.appendChild(grid);
    root.appendChild(body);
  } else {
    const header = el('div', `${p}-popup__header`);
    header.appendChild(sequence(p, snap.popup.currentSequence));
    root.appendChild(header);
    const list = el('ul', `${p}-popup__list`);
    snap.popup.candidates.forEach((c) => {
      const li = document.createElement('li');
      li.appendChild(row(p, c));
      list.appendChild(li);
    });
    root.appendChild(list);
  }
  return root;
};
