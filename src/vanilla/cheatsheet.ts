import type { CheatsheetModel } from '../engine';
import { CHEATSHEET_TITLE_ID, trapTab } from '../shared/focus-trap';

const kbd = (p: string, text: string): HTMLElement => {
  const el = document.createElement('kbd');
  el.className = `${p}-kbd`;
  el.textContent = text;
  return el;
};

const item = (p: string, keys: string, description: string | undefined): HTMLElement => {
  const li = document.createElement('li');
  li.className = `${p}-cheatsheet__item`;
  li.appendChild(kbd(p, keys));
  const span = document.createElement('span');
  span.textContent = description ?? '(no description)';
  li.appendChild(span);
  return li;
};

export const renderCheatsheet = (
  p: string,
  model: CheatsheetModel,
  onClose: () => void,
): { element: HTMLElement; destroy: () => void } => {
  const backdrop = document.createElement('div');
  backdrop.className = `${p}-backdrop`;
  backdrop.dataset.testid = 'whichkey-cheatsheet-backdrop';
  backdrop.addEventListener('click', onClose);

  const panel = document.createElement('div');
  panel.className = `${p}-cheatsheet`;
  panel.dataset.testid = 'whichkey-cheatsheet';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', CHEATSHEET_TITLE_ID);
  panel.tabIndex = -1;
  panel.addEventListener('click', (e) => e.stopPropagation());

  const close = document.createElement('button');
  close.type = 'button';
  close.className = `${p}-cheatsheet__close`;
  close.setAttribute('aria-label', 'Close keyboard shortcuts');
  close.textContent = '×';
  close.addEventListener('click', onClose);
  panel.appendChild(close);

  const title = document.createElement('h2');
  title.className = `${p}-cheatsheet__title`;
  title.id = CHEATSHEET_TITLE_ID;
  title.textContent = 'Keyboard shortcuts';
  panel.appendChild(title);

  const sections = document.createElement('div');
  sections.className = `${p}-cheatsheet__sections`;

  if (model.standalone.length > 0) {
    const ul = document.createElement('ul');
    ul.className = `${p}-cheatsheet__list`;
    model.standalone.forEach((e) => ul.appendChild(item(p, e.keys, e.description)));
    sections.appendChild(ul);
  }
  model.groups.forEach((g) => {
    const section = document.createElement('section');
    section.className = `${p}-cheatsheet__section`;
    const h3 = document.createElement('h3');
    h3.className = `${p}-cheatsheet__group-title`;
    h3.appendChild(kbd(p, g.prefix));
    if (g.description) {
      const span = document.createElement('span');
      span.className = `${p}-cheatsheet__group-label`;
      span.textContent = g.description;
      h3.appendChild(span);
    }
    section.appendChild(h3);
    const ul = document.createElement('ul');
    ul.className = `${p}-cheatsheet__list ${p}-cheatsheet__list--nested`;
    g.entries.forEach((e) => ul.appendChild(item(p, e.keys, e.description)));
    section.appendChild(ul);
    sections.appendChild(section);
  });

  panel.appendChild(sections);
  const hint = document.createElement('div');
  hint.className = `${p}-cheatsheet__hint`;
  hint.textContent = 'Press Escape to close.';
  panel.appendChild(hint);
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
