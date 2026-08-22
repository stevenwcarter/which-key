import type { WhichKeyEngine } from '../engine';
import { renderPopup, type PopupOptions } from './popup';
import { renderCheatsheet } from './cheatsheet';
import { DEFAULT_BACKGROUND_OPACITY, DEFAULT_MAX_ROWS } from '../shared/clamp';

export type MountOptions = {
  popup?: Partial<PopupOptions> | false;
  cheatsheet?: boolean;
  container?: HTMLElement;
  classPrefix?: string;
};

export const mountWhichKey = (
  engine: WhichKeyEngine, opts: MountOptions = {},
): { unmount(): void } => {
  const container = opts.container ?? document.body;
  const prefix = opts.classPrefix ?? 'wk';
  const showCheatsheet = opts.cheatsheet ?? true;
  const popupOpts: PopupOptions | null = opts.popup === false ? null : {
    layout: opts.popup?.layout ?? 'vertical',
    maxRows: opts.popup?.maxRows ?? DEFAULT_MAX_ROWS,
    backgroundOpacity: opts.popup?.backgroundOpacity ?? DEFAULT_BACKGROUND_OPACITY,
  };

  let popupNode: HTMLElement | null = null;
  let cheatsheetNode: HTMLElement | null = null;
  let cheatsheetDestroy: (() => void) | null = null;

  const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') engine.closeCheatsheet(); };

  const render = () => {
    const snap = engine.getSnapshot();
    // Popup
    popupNode?.remove();
    popupNode = null;
    if (popupOpts) {
      const node = renderPopup(prefix, snap, popupOpts);
      if (node) { container.appendChild(node); popupNode = node; }
    }
    // Cheatsheet
    if (showCheatsheet) {
      if (snap.cheatsheet.visible && !cheatsheetNode) {
        const sheet = renderCheatsheet(prefix, engine.getCheatsheetModel(), () => engine.closeCheatsheet());
        cheatsheetNode = sheet.element;
        cheatsheetDestroy = sheet.destroy;
        container.appendChild(cheatsheetNode);
        (cheatsheetNode.querySelector(`.${prefix}-cheatsheet`) as HTMLElement | null)?.focus();
        document.addEventListener('keydown', onEscape);
      } else if (!snap.cheatsheet.visible && cheatsheetNode) {
        cheatsheetNode.remove();
        cheatsheetNode = null;
        cheatsheetDestroy?.();
        cheatsheetDestroy = null;
        document.removeEventListener('keydown', onEscape);
      }
    }
  };

  const unsubscribe = engine.subscribe(render);
  render();

  return {
    unmount() {
      unsubscribe();
      popupNode?.remove();
      cheatsheetNode?.remove();
      cheatsheetDestroy?.();
      cheatsheetDestroy = null;
      document.removeEventListener('keydown', onEscape);
    },
  };
};
