import type { CheatsheetModel } from '../engine';
import { CHEATSHEET_TITLE_ID, trapTab } from '../shared/focus-trap';
import { CHEATSHEET_HINT, NO_DESCRIPTION, SHORTCUTS_LABEL } from '../shared/strings';
import { el, kbd } from './dom';

const item = (p: string, keys: string, description: string | undefined): HTMLElement => {
  const li = el('li', `${p}-cheatsheet__item`);
  li.appendChild(kbd(p, keys));
  const span = document.createElement('span');
  span.textContent = description ?? NO_DESCRIPTION;
  li.appendChild(span);
  return li;
};

export const renderCheatsheet = (
  p: string,
  model: CheatsheetModel,
  onClose: () => void,
): { element: HTMLElement; destroy: () => void } => {
  const backdrop = el('div', `${p}-backdrop`);
  backdrop.dataset.testid = 'whichkey-cheatsheet-backdrop';
  backdrop.addEventListener('click', onClose);

  const panel = el('div', `${p}-cheatsheet`);
  panel.dataset.testid = 'whichkey-cheatsheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', CHEATSHEET_TITLE_ID);
  panel.tabIndex = -1;
  panel.addEventListener('click', (e) => e.stopPropagation());

  const close = el('button', `${p}-cheatsheet__close`, '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close keyboard shortcuts');
  close.addEventListener('click', onClose);
  panel.appendChild(close);

  const title = el('h2', `${p}-cheatsheet__title`, SHORTCUTS_LABEL);
  title.id = CHEATSHEET_TITLE_ID;
  panel.appendChild(title);

  const sections = el('div', `${p}-cheatsheet__sections`);

  if (model.standalone.length > 0) {
    const ul = el('ul', `${p}-cheatsheet__list`);
    model.standalone.forEach((e) => ul.appendChild(item(p, e.keys, e.description)));
    sections.appendChild(ul);
  }
  model.groups.forEach((g) => {
    const section = el('section', `${p}-cheatsheet__section`);
    const h3 = el('h3', `${p}-cheatsheet__group-title`);
    h3.appendChild(kbd(p, g.prefix));
    if (g.description) {
      h3.appendChild(el('span', `${p}-cheatsheet__group-label`, g.description));
    }
    section.appendChild(h3);
    const ul = el('ul', `${p}-cheatsheet__list ${p}-cheatsheet__list--nested`);
    g.entries.forEach((e) => ul.appendChild(item(p, e.keys, e.description)));
    section.appendChild(ul);
    sections.appendChild(section);
  });

  panel.appendChild(sections);
  panel.appendChild(el('div', `${p}-cheatsheet__hint`, CHEATSHEET_HINT));
  backdrop.appendChild(panel);

  // NB: focus is NOT moved here — the node is not in the document yet, so
  // panel.focus() would be a no-op. mount.ts focuses it after appendChild.
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const onKey = (e: KeyboardEvent) => trapTab(panel, e);
  document.addEventListener('keydown', onKey);

  return {
    element: backdrop,
    destroy: () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    },
  };
};
