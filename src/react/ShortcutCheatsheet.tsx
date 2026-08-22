import { useContext, useEffect, useMemo, useRef, type RefObject } from 'react';
import { WhichKeyContext } from './context';
import { Kbd } from './Kbd';
import { useEngineSnapshot } from './useEngineSnapshot';
import type { CheatsheetEntry, CheatsheetGroup, CheatsheetModel } from '../engine';
import { CHEATSHEET_TITLE_ID, trapTab } from '../shared/focus-trap';
import { CHEATSHEET_HINT, NO_DESCRIPTION, SHORTCUTS_LABEL } from '../shared/strings';

// Hoisted so the closed-sheet case returns the same object identity on every
// render — a fresh `{ standalone: [], groups: [] }` literal per call would
// defeat useMemo for any consumer comparing the model by reference.
const EMPTY_MODEL: CheatsheetModel = { standalone: [], groups: [] };

// Hoisted so the no-engine case hands the trap a stable identity; a fresh
// `() => {}` per render would re-run its effect on every render.
const noop = () => {};

/**
 * While `active`: moves focus into `panelRef`, cycles Tab inside it, closes on
 * `Escape`, and restores focus to the previously focused element on teardown.
 */
const useCheatsheetFocusTrap = (
  panelRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  onEscape: () => void,
): void => {
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
        return;
      }
      const panel = panelRef.current;
      if (panel) trapTab(panel, e);
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [panelRef, active, onEscape]);
};

const EntryRow = ({ entry }: { entry: CheatsheetEntry }) => (
  <li className="wk-cheatsheet__item">
    <Kbd>{entry.keys}</Kbd>
    <span>{entry.description ?? NO_DESCRIPTION}</span>
  </li>
);

const GroupSection = ({ group }: { group: CheatsheetGroup }) => (
  <section className="wk-cheatsheet__section">
    <h3 className="wk-cheatsheet__group-title">
      <Kbd>{group.prefix}</Kbd>
      {group.description ? (
        <span className="wk-cheatsheet__group-label">{group.description}</span>
      ) : null}
    </h3>
    <ul className="wk-cheatsheet__list wk-cheatsheet__list--nested">
      {group.entries.map((e) => (
        <EntryRow key={e.keys} entry={e} />
      ))}
    </ul>
  </section>
);

/**
 * Full-screen cheatsheet of every active shortcut. Takes no props and renders
 * `null` while the cheatsheet is closed — and during server rendering, so it is
 * SSR-safe and activates after hydration.
 *
 * While open it traps Tab focus inside the panel, closes on `Escape`, and
 * restores focus to the previously focused element on close. Emits the fixed
 * `wk-*` class names styled by `which-key/styles.css`.
 */
export const ShortcutCheatsheet = () => {
  const engine = useContext(WhichKeyContext);
  const visible = useEngineSnapshot(engine, '<ShortcutCheatsheet>').cheatsheet.visible;

  const panelRef = useRef<HTMLDivElement>(null);
  useCheatsheetFocusTrap(panelRef, Boolean(engine) && visible, engine?.closeCheatsheet ?? noop);

  // Read before the early return — hooks must run unconditionally. Keyed on
  // the registry's version (not just `visible`) so a late registration made
  // while the sheet is already open still invalidates the memo; keying on
  // `visible` alone would freeze the sheet at its open-time contents.
  const registryVersion = engine?.registry.version ?? 0;
  // registryVersion is deliberately unreferenced inside the factory below:
  // it is a cache-invalidation signal for state the engine owns internally
  // (the registry's mutation counter), not a value the computation itself
  // reads. exhaustive-deps only sees identifiers used in the callback body,
  // so it can't know this dep is load-bearing for invalidating a memo over a
  // mutable, non-React-tracked data source.
  //
  // The `visible` gate inside the factory (not just as a dep) is equally
  // load-bearing, the other direction: without it, every mounted
  // <ShortcutCheatsheet> would rebuild its model — a registry scan, bucketing
  // and sort — on every emit from ANY engine mutation (e.g. every
  // activateLayer from a sibling <WhichKeyLayer> mount/unmount), even while
  // this sheet is closed. Hooks still run unconditionally; only the
  // (real, expensive) computation is skipped.
  const model = useMemo(
    () => (engine && visible ? engine.getCheatsheetModel() : EMPTY_MODEL),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, registryVersion, visible],
  );

  if (!engine || !visible) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- click-to-dismiss backdrop; the keyboard equivalent is the Escape handler installed by useCheatsheetFocusTrap above, and the panel (not the backdrop) is the focus target of this modal.
    <div
      data-testid="whichkey-cheatsheet-backdrop"
      className="wk-backdrop"
      onClick={engine.closeCheatsheet}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- onClick here only stops propagation to the backdrop's close handler; it has no interactive behavior of its own, so no keyboard equivalent is needed. */}
      <div
        ref={panelRef}
        data-testid="whichkey-cheatsheet"
        className="wk-cheatsheet"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={CHEATSHEET_TITLE_ID}
      >
        <button
          type="button"
          className="wk-cheatsheet__close"
          aria-label="Close keyboard shortcuts"
          onClick={engine.closeCheatsheet}
        >
          ×
        </button>
        <h2 id={CHEATSHEET_TITLE_ID} className="wk-cheatsheet__title">
          {SHORTCUTS_LABEL}
        </h2>
        <div className="wk-cheatsheet__sections">
          {model.standalone.length > 0 && (
            <ul className="wk-cheatsheet__list">
              {model.standalone.map((e) => (
                <EntryRow key={e.keys} entry={e} />
              ))}
            </ul>
          )}
          {model.groups.map((g) => (
            <GroupSection key={g.prefix} group={g} />
          ))}
        </div>
        <div className="wk-cheatsheet__hint">{CHEATSHEET_HINT}</div>
      </div>
    </div>
  );
};
