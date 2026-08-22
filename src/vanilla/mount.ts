import type { WhichKeyEngine } from '../engine';
import { renderPopup, type PopupOptions } from './popup';
import { renderCheatsheet } from './cheatsheet';
import { DEFAULT_BACKGROUND_OPACITY, DEFAULT_MAX_ROWS } from '../shared/clamp';

/** Options for `mountWhichKey`. */
export type MountOptions = {
  /**
   * Popup renderer options, merged over the defaults
   * (`{ layout: 'vertical', maxRows: 5, backgroundOpacity: 0.95 }`). Pass
   * `false` to suppress the popup entirely.
   */
  popup?: Partial<PopupOptions> | false;
  /** Whether to render the cheatsheet. Defaults to `true`. */
  cheatsheet?: boolean;
  /** Node the rendered elements are appended to. Defaults to `document.body`. */
  container?: HTMLElement;
  /**
   * Replaces the `wk-` class prefix. Defaults to `'wk'`; a value that is not a
   * valid CSS identifier stem warns and falls back to it. Setting it opts out of
   * `which-key/styles.css`, which hardcodes `.wk-*` selectors, so you must
   * supply a stylesheet covering the whole class contract yourself.
   */
  classPrefix?: string;
};

/** Teardown handle returned by `mountWhichKey`. */
export type WhichKeyMountHandle = { unmount(): void };

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

/**
 * Subscribes a vanilla-DOM renderer to the engine and renders once immediately.
 * Returns a handle whose `unmount()` removes every node and listener the
 * renderer created; it is idempotent.
 *
 * It does not call `engine.start()` — attach the keydown listener yourself.
 * Only one renderer may be live per container: a second call for a container
 * that already has one warns and returns a no-op handle.
 */
export const mountWhichKey = (
  engine: WhichKeyEngine,
  opts: MountOptions = {},
): WhichKeyMountHandle => {
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
          'must be a valid CSS identifier stem: letters, digits, "-" and "_", where the first ' +
          'character (or the character right after a leading "-") is a letter or "_", never a digit. ' +
          'Falling back to "wk".',
      );
    }
  }
  const showCheatsheet = opts.cheatsheet ?? true;
  const popupOpts: PopupOptions | null =
    opts.popup === false
      ? null
      : {
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

  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') engine.closeCheatsheet();
  };

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
        const sheet = renderCheatsheet(prefix, engine.getCheatsheetModel(), () =>
          engine.closeCheatsheet(),
        );
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
