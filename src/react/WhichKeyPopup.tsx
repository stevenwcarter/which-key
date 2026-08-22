import type { CSSProperties, ReactNode } from 'react';
import { useWhichKeyState } from './useWhichKeyState';
import type { WhichKeyCandidate, WhichKeyState } from '../engine';
import { clamp01, clampRows, DEFAULT_BACKGROUND_OPACITY, DEFAULT_MAX_ROWS } from '../shared/clamp';

export type WhichKeyPopupLayout = 'vertical' | 'horizontal';
export type WhichKeyPopupProps = {
  layout?: WhichKeyPopupLayout;
  maxRows?: number;
  backgroundOpacity?: number;
};

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="wk-kbd">{children}</kbd>;

const Sequence = ({ sequence }: { sequence: string[] }) => (
  <div data-testid="whichkey-popup-sequence" className="wk-sequence">
    {sequence.map((k, i) => (
      <Kbd key={i}>{k}</Kbd>
    ))}
    <span className="wk-sequence__ellipsis">…</span>
  </div>
);

const CandidateRow = ({ c }: { c: WhichKeyCandidate }) => (
  <div className={c.isGroup ? 'wk-row wk-row--group' : 'wk-row'}>
    <Kbd>{c.nextKey}</Kbd>
    <span className="wk-row__label">
      {c.isGroup ? '+' : ''}
      {c.description ?? c.keys}
    </span>
  </div>
);

const VerticalCorner = ({ state, bgOpacity }: { state: WhichKeyState; bgOpacity: number }) => (
  <div
    data-testid="whichkey-popup"
    data-layout="vertical"
    className="wk-popup wk-popup--vertical"
    // CSSProperties has no index signature for custom properties; the cast
    // is narrowed to exactly this one declaration. The colour itself lives
    // in src/styles.css (--wk-panel-bg-rgb) so a light-preferring OS or an
    // explicit data-wk-theme can still repaint the popup — only the runtime
    // opacity prop needs to reach the element.
    style={{ '--wk-popup-bg-opacity': bgOpacity } as CSSProperties}
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="Keyboard shortcuts"
  >
    <div className="wk-popup__header">
      <Sequence sequence={state.currentSequence} />
    </div>
    <ul className="wk-popup__list">
      {state.candidates.map((c) => (
        <li key={c.keys}>
          <CandidateRow c={c} />
        </li>
      ))}
    </ul>
  </div>
);

const HorizontalBar = ({
  state,
  bgOpacity,
  rows,
}: {
  state: WhichKeyState;
  bgOpacity: number;
  rows: number;
}) => (
  <div
    data-testid="whichkey-popup"
    data-layout="horizontal"
    className="wk-popup wk-popup--horizontal"
    // See VerticalCorner above for why this is a narrow custom-property cast.
    style={{ '--wk-popup-bg-opacity': bgOpacity } as CSSProperties}
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="Keyboard shortcuts"
  >
    <div className="wk-popup__body">
      <Sequence sequence={state.currentSequence} />
      <div
        data-testid="whichkey-popup-grid"
        className="wk-popup__grid"
        style={{ gridTemplateRows: `repeat(${rows}, auto)` }}
      >
        {state.candidates.map((c) => (
          <CandidateRow key={c.keys} c={c} />
        ))}
      </div>
    </div>
  </div>
);

export const WhichKeyPopup = ({
  layout = 'vertical',
  maxRows = DEFAULT_MAX_ROWS,
  backgroundOpacity = DEFAULT_BACKGROUND_OPACITY,
}: WhichKeyPopupProps = {}) => {
  const state = useWhichKeyState('<WhichKeyPopup>');
  if (!state.visible) return null;
  const bgOpacity = clamp01(backgroundOpacity);
  return layout === 'horizontal' ? (
    <HorizontalBar state={state} bgOpacity={bgOpacity} rows={clampRows(maxRows)} />
  ) : (
    <VerticalCorner state={state} bgOpacity={bgOpacity} />
  );
};
