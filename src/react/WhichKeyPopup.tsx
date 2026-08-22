import type { CSSProperties, ReactNode } from 'react';
import { useWhichKeyState } from './useWhichKeyState';
import type { WhichKeyCandidate, WhichKeyState } from '../engine';
import { clamp01, clampRows, DEFAULT_BACKGROUND_OPACITY, DEFAULT_MAX_ROWS } from '../shared/clamp';
import { SHORTCUTS_LABEL } from '../shared/strings';

/** Popup placement: a corner panel (`'vertical'`) or a bottom bar (`'horizontal'`). */
export type WhichKeyPopupLayout = 'vertical' | 'horizontal';
/** Props for `<WhichKeyPopup>`. Out-of-range values are clamped, never rejected. */
export type WhichKeyPopupProps = {
  /** Corner popup or bottom bar. Defaults to `'vertical'`. */
  layout?: WhichKeyPopupLayout;
  /**
   * Maximum rows in the horizontal grid. Defaults to `5`; other values are
   * floored to an integer of at least `1`, and a non-finite value falls back to
   * the default.
   */
  maxRows?: number;
  /**
   * Panel background alpha. Defaults to `0.95`; other values are clamped to
   * `0`-`1`, and a non-finite value falls back to the default.
   */
  backgroundOpacity?: number;
};

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="wk-kbd">{children}</kbd>;

const Sequence = ({ sequence }: { sequence: readonly string[] }) => (
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
    aria-label={SHORTCUTS_LABEL}
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
    aria-label={SHORTCUTS_LABEL}
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

/**
 * Renders the pending-sequence popup, listing the keys that can follow what has
 * been pressed so far. Returns `null` when the popup is not visible — including
 * during server rendering, so it is SSR-safe and activates after hydration.
 *
 * Emits the fixed `wk-*` class names styled by `which-key/styles.css`.
 */
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
