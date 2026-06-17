import type { WhichKeyCandidate, WhichKeySnapshot } from '../engine';

export type PopupOptions = { layout: 'vertical' | 'horizontal'; maxRows: number; backgroundOpacity: number };
const PANEL_BG_RGB = '17, 24, 39';
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampRows = (n: number) => Math.max(1, Math.floor(n));

const kbd = (p: string, text: string): HTMLElement => {
  const el = document.createElement('kbd');
  el.className = `${p}-kbd`;
  el.textContent = text;
  return el;
};

const row = (p: string, c: WhichKeyCandidate): HTMLElement => {
  const r = document.createElement('div');
  r.className = c.isGroup ? `${p}-row ${p}-row--group` : `${p}-row`;
  r.appendChild(kbd(p, c.nextKey));
  const label = document.createElement('span');
  label.className = `${p}-row__label`;
  label.textContent = `${c.isGroup ? '+' : ''}${c.description ?? c.keys}`;
  r.appendChild(label);
  return r;
};

const sequence = (p: string, seq: string[]): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.className = `${p}-sequence`;
  wrap.dataset.testid = 'whichkey-popup-sequence';
  seq.forEach((k) => wrap.appendChild(kbd(p, k)));
  const ell = document.createElement('span');
  ell.className = `${p}-sequence__ellipsis`;
  ell.textContent = '…';
  wrap.appendChild(ell);
  return wrap;
};

export const renderPopup = (p: string, snap: WhichKeySnapshot, opts: PopupOptions): HTMLElement | null => {
  if (!snap.popup.visible) return null;
  const bg = `rgba(${PANEL_BG_RGB}, ${clamp01(opts.backgroundOpacity)})`;
  const el = document.createElement('div');
  el.dataset.testid = 'whichkey-popup';
  el.dataset.layout = opts.layout;
  el.className = `${p}-popup ${p}-popup--${opts.layout}`;
  el.style.backgroundColor = bg;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Keyboard shortcuts');
  if (opts.layout === 'horizontal') {
    const body = document.createElement('div');
    body.className = `${p}-popup__body`;
    body.appendChild(sequence(p, snap.popup.currentSequence));
    const grid = document.createElement('div');
    grid.className = `${p}-popup__grid`;
    grid.dataset.testid = 'whichkey-popup-grid';
    grid.style.gridTemplateRows = `repeat(${clampRows(opts.maxRows)}, auto)`;
    snap.popup.candidates.forEach((c) => grid.appendChild(row(p, c)));
    body.appendChild(grid);
    el.appendChild(body);
  } else {
    const header = document.createElement('div');
    header.className = `${p}-popup__header`;
    header.appendChild(sequence(p, snap.popup.currentSequence));
    el.appendChild(header);
    const list = document.createElement('ul');
    list.className = `${p}-popup__list`;
    snap.popup.candidates.forEach((c) => {
      const li = document.createElement('li');
      li.appendChild(row(p, c));
      list.appendChild(li);
    });
    el.appendChild(list);
  }
  return el;
};
