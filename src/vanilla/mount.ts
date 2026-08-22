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

// One live renderer per container. A second mount (hot reload, a route change
// that remounts without unmounting, two modules wiring the same engine) used
// to append a SECOND popup and cheatsheet — two nodes with the same
// data-testid and the same role="dialog" aria-label, an escape listener bound
// twice, and a first unmount() that left the second renderer live.
const mountedContainers = new WeakSet<HTMLElement>();

// The prefix is interpolated raw into every className, so a space splits one
// class into several ('my app' -> "my app-popup"), and a leading digit or a
// '.'/'#'/':' produces a class that is valid HTML but unselectable without
// escaping — either way the consumer's stylesheet silently never applies.
const CLASS_PREFIX_RE = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;

export const mountWhichKey = (
  engine: WhichKeyEngine, opts: MountOptions = {},
): { unmount(): void } => {
  const container = opts.container ?? document.body;

  if (mountedContainers.has(container)) {
    console.warn(
      '[whichkey] mountWhichKey called twice for the same container; ' +
        'the previous mount is still active. Call unmount() on it first. ' +
        'This call is a no-op.',
    );
    return { unmount() {} };
  }
  mountedContainers.add(container);

  const requestedPrefix = opts.classPrefix;
  let prefix = 'wk';
  if (requestedPrefix !== undefined) {
    if (CLASS_PREFIX_RE.test(requestedPrefix)) {
      prefix = requestedPrefix;
    } else {
      console.warn(
        `[whichkey] invalid classPrefix "${requestedPrefix}"; ` +
          'must be a valid CSS identifier stem (letters, digits, "-", "_"; not starting with a digit). ' +
          'Falling back to "wk".',
      );
    }
  }
  const showCheatsheet = opts.cheatsheet ?? true;
  const popupOpts: PopupOptions | null = opts.popup === false ? null : {
    layout: opts.popup?.layout ?? 'vertical',
    maxRows: opts.popup?.maxRows ?? DEFAULT_MAX_ROWS,
    backgroundOpacity: opts.popup?.backgroundOpacity ?? DEFAULT_BACKGROUND_OPACITY,
  };

  // A stable host appended ONCE, before any cheatsheet backdrop. The previous
  // code removed and re-appended the popup on every emit, so once the
  // cheatsheet was open the popup landed AFTER the backdrop in DOM order —
  // and since both share a z-index, DOM order decides painting, so the popup
  // drew on top of the full-screen overlay. React reconciles in place and
  // does not have this bug; this keeps the two renderers in agreement. It
  // also stops a full detach/reattach + style recalc on every keystroke.
  const popupHost = document.createElement('div');
  popupHost.className = `${prefix}-popup-host`;
  popupHost.hidden = true;
  if (popupOpts) container.appendChild(popupHost);

  let cheatsheetNode: HTMLElement | null = null;
  let cheatsheetDestroy: (() => void) | null = null;

  const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') engine.closeCheatsheet(); };

  const render = () => {
    const snap = engine.getSnapshot();
    // Popup — replace children in place; never move the host.
    if (popupOpts) {
      const node = renderPopup(prefix, snap, popupOpts);
      if (node) {
        popupHost.replaceChildren(node);
        popupHost.hidden = false;
      } else {
        popupHost.replaceChildren();
        popupHost.hidden = true;
      }
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

  let unmounted = false;
  return {
    unmount() {
      if (unmounted) return;
      unmounted = true;
      mountedContainers.delete(container);
      unsubscribe();
      popupHost.remove();
      cheatsheetNode?.remove();
      cheatsheetDestroy?.();
      cheatsheetDestroy = null;
      document.removeEventListener('keydown', onEscape);
    },
  };
};
