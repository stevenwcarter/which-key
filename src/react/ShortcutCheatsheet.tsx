import { useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { WhichKeyContext } from './context';

const Kbd = ({ children }: { children: ReactNode }) => <kbd className="wk-kbd">{children}</kbd>;

export const ShortcutCheatsheet = () => {
  const engine = useContext(WhichKeyContext);
  const snapshot = useSyncExternalStore(
    engine ? engine.subscribe : () => () => {},
    engine ? engine.getSnapshot : () => null,
  );
  const visible = snapshot?.cheatsheet.visible ?? false;

  useEffect(() => {
    if (!engine || !visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') engine.closeCheatsheet(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [engine, visible]);

  if (!engine || !visible) return null;
  const model = engine.getCheatsheetModel();

  return (
    <div data-testid="whichkey-cheatsheet-backdrop" className="wk-backdrop" onClick={engine.closeCheatsheet}>
      <div data-testid="whichkey-cheatsheet" className="wk-cheatsheet" onClick={(e) => e.stopPropagation()}
           role="dialog" aria-label="All keyboard shortcuts">
        <h2 className="wk-cheatsheet__title">Keyboard shortcuts</h2>
        <div className="wk-cheatsheet__sections">
          {model.standalone.length > 0 && (
            <ul className="wk-cheatsheet__list">
              {model.standalone.map((e) => (
                <li key={e.keys} className="wk-cheatsheet__item">
                  <Kbd>{e.keys}</Kbd><span>{e.description ?? '(no description)'}</span>
                </li>
              ))}
            </ul>
          )}
          {model.groups.map((g) => (
            <section key={g.prefix} className="wk-cheatsheet__section">
              <h3 className="wk-cheatsheet__group-title">
                <Kbd>{g.prefix}</Kbd>
                {g.description ? <span className="wk-cheatsheet__group-label">{g.description}</span> : null}
              </h3>
              <ul className="wk-cheatsheet__list wk-cheatsheet__list--nested">
                {g.entries.map((e) => (
                  <li key={e.keys} className="wk-cheatsheet__item">
                    <Kbd>{e.keys}</Kbd><span>{e.description ?? '(no description)'}</span>
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
