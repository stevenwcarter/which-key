import { useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { WhichKeyContext, warnNoProvider } from './context';

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="wk-kbd">{children}</kbd>;

const noopSubscribe = () => () => {};
const getNullSnapshot = () => null;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CHEATSHEET_TITLE_ID = 'wk-cheatsheet-title';

export const ShortcutCheatsheet = () => {
  const engine = useContext(WhichKeyContext);
  const snapshot = useSyncExternalStore(
    engine ? engine.subscribe : noopSubscribe,
    engine ? engine.getSnapshot : getNullSnapshot,
    getNullSnapshot,
  );
  const visible = snapshot?.cheatsheet.visible ?? false;

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!engine) warnNoProvider('<ShortcutCheatsheet>');
  }, [engine]);

  useEffect(() => {
    if (!engine || !visible) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        engine.closeCheatsheet();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [engine, visible]);

  if (!engine || !visible) return null;
  const model = engine.getCheatsheetModel();

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- click-to-dismiss backdrop; the keyboard equivalent is the Escape handler installed in the useEffect above, and the panel (not the backdrop) is the focus target of this modal.
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
          Keyboard shortcuts
        </h2>
        <div className="wk-cheatsheet__sections">
          {model.standalone.length > 0 && (
            <ul className="wk-cheatsheet__list">
              {model.standalone.map((e) => (
                <li key={e.keys} className="wk-cheatsheet__item">
                  <Kbd>{e.keys}</Kbd>
                  <span>{e.description ?? '(no description)'}</span>
                </li>
              ))}
            </ul>
          )}
          {model.groups.map((g) => (
            <section key={g.prefix} className="wk-cheatsheet__section">
              <h3 className="wk-cheatsheet__group-title">
                <Kbd>{g.prefix}</Kbd>
                {g.description ? (
                  <span className="wk-cheatsheet__group-label">{g.description}</span>
                ) : null}
              </h3>
              <ul className="wk-cheatsheet__list wk-cheatsheet__list--nested">
                {g.entries.map((e) => (
                  <li key={e.keys} className="wk-cheatsheet__item">
                    <Kbd>{e.keys}</Kbd>
                    <span>{e.description ?? '(no description)'}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="wk-cheatsheet__hint">Press Escape to close.</div>
      </div>
    </div>
  );
};
