// Element-construction helpers for the vanilla renderers. Module-private: not
// re-exported from src/vanilla/index.ts, so no public-API change.
//
// Every helper writes textContent, never innerHTML — the project's consistent
// choice, kept deliberate by routing element creation through one place.

/** Creates an element, sets its class, and optionally its text. */
export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A `<kbd>` key cap under the caller's class prefix. */
export const kbd = (p: string, text: string): HTMLElement => el('kbd', `${p}-kbd`, text);
