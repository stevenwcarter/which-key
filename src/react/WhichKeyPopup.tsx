import type { ReactNode } from 'react';
import { useWhichKeyState } from './useWhichKeyState';
import type { WhichKeyCandidate, WhichKeyState } from '../engine';

export type WhichKeyPopupLayout = 'vertical' | 'horizontal';
export type WhichKeyPopupProps = {
  layout?: WhichKeyPopupLayout;
  maxRows?: number;
  backgroundOpacity?: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampRows = (n: number) => Math.max(1, Math.floor(n));
const PANEL_BG_RGB = '17, 24, 39';

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="wk-kbd">{children}</kbd>;

const Sequence = ({ sequence }: { sequence: string[] }) => (
  <div data-testid="whichkey-popup-sequence" className="wk-sequence">
    {sequence.map((k, i) => <Kbd key={i}>{k}</Kbd>)}
    <span className="wk-sequence__ellipsis">…</span>
  </div>
);

const CandidateRow = ({ c }: { c: WhichKeyCandidate }) => (
  <div className={c.isGroup ? 'wk-row wk-row--group' : 'wk-row'}>
    <Kbd>{c.nextKey}</Kbd>
    <span className="wk-row__label">{c.isGroup ? '+' : ''}{c.description ?? c.keys}</span>
  </div>
);

const VerticalCorner = ({ state, bg }: { state: WhichKeyState; bg: string }) => (
  <div data-testid="whichkey-popup" data-layout="vertical" className="wk-popup wk-popup--vertical"
       style={{ backgroundColor: bg }} role="status" aria-live="polite" aria-atomic="true" aria-label="Keyboard shortcuts">
    <div className="wk-popup__header"><Sequence sequence={state.currentSequence} /></div>
    <ul className="wk-popup__list">
      {state.candidates.map((c) => <li key={c.keys}><CandidateRow c={c} /></li>)}
    </ul>
  </div>
);

const HorizontalBar = ({ state, bg, rows }: { state: WhichKeyState; bg: string; rows: number }) => (
  <div data-testid="whichkey-popup" data-layout="horizontal" className="wk-popup wk-popup--horizontal"
       style={{ backgroundColor: bg }} role="status" aria-live="polite" aria-atomic="true" aria-label="Keyboard shortcuts">
    <div className="wk-popup__body">
      <Sequence sequence={state.currentSequence} />
      <div data-testid="whichkey-popup-grid" className="wk-popup__grid"
           style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
        {state.candidates.map((c) => <CandidateRow key={c.keys} c={c} />)}
      </div>
    </div>
  </div>
);

export const WhichKeyPopup = ({
  layout = 'vertical', maxRows = 5, backgroundOpacity = 0.95,
}: WhichKeyPopupProps = {}) => {
  const state = useWhichKeyState();
  if (!state.visible) return null;
  const bg = `rgba(${PANEL_BG_RGB}, ${clamp01(backgroundOpacity)})`;
  return layout === 'horizontal'
    ? <HorizontalBar state={state} bg={bg} rows={clampRows(maxRows)} />
    : <VerticalCorner state={state} bg={bg} />;
};
