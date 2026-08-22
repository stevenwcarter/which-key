import { eventToCanonical, isInputTarget, isModifierOnlyEvent } from './keys';
import type { ShortcutRegistry } from './registry';
import type { ShortcutEntry } from './types';

/**
 * Callbacks the `Matcher` drives as each keystroke resolves. `createWhichKey`
 * supplies these; they are not part of the public engine surface.
 */
export type MatcherOptions = {
  /** How long a committed prefix waits before its popup shows or its leaf fires. */
  timeoutMs: number;
  /** Fires a resolved shortcut, passing the original `keydown` that completed it. */
  onFire: (entry: ShortcutEntry, event: KeyboardEvent) => void;
  /**
   * Shows or refreshes the popup for the sequence committed so far.
   * `currentSequence` is a per-call copy of the matcher's buffer; treat it as
   * read-only.
   */
  onShowPopup: (state: { currentSequence: string[] }) => void;
  /**
   * Hides the popup. Called on every buffer reset, so it can fire when nothing
   * is on screen.
   */
  onHidePopup: () => void;
};

// A keystroke "echoes a character" when the browser would insert visible text
// into a focused field for it — the only case where surfacing the buffered
// key in the which-key popup could leak field content on screen. Everything
// else (Escape, Tab, arrows, function keys, bare Ctrl/Cmd chords) is safe to
// surface even when typed into a field:
//   - `key.length === 1` — only single-character keys insert text. Multi-char
//     key names ("Escape", "ArrowUp", "F1", ...) never do.
//   - `!metaKey` — Cmd-chords don't insert text.
//   - `!(ctrlKey && !altKey)` — a plain Ctrl-chord doesn't insert text, but
//     Ctrl+Alt is AltGr on Windows/Linux and DOES: many layouts produce `@`,
//     `\`, `{` and similar via AltGr, and those characters can appear in a
//     password. Do not simplify this to `!ctrlKey` — that reopens the AltGr
//     leak on non-US layouts.
//   - Alt alone stays true: Option-chords insert characters on macOS
//     (Option+x -> "≈").
const echoesCharacter = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.metaKey && !(event.ctrlKey && !event.altKey);

/**
 * Resolves `keydown` events against the registry, owning the pending-sequence
 * buffer and every timer involved.
 *
 * Canonicalizing a key onto the buffer leads to one of three outcomes: a pure
 * leaf (a match with no continuations) fires immediately; a key that is both a
 * leaf and a prefix commits the buffer and fires after `timeoutMs` unless a
 * continuation arrives first; a prefix-only key commits the buffer and shows
 * the popup after `timeoutMs`, refreshing it immediately if it is already up.
 * `Escape` cancels a partial sequence unless an explicit `Escape` leaf exists
 * for the prospective sequence.
 */
export class Matcher {
  private buffer: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private popupVisible = false;
  // Once any keystroke in the current buffer was typed into a text field AND
  // would have echoed a character there (see `echoesCharacter`), the popup
  // must stay suppressed for the rest of this buffer — even after focus moves
  // outside the field — so a later outside-field keystroke never flushes the
  // buffered field characters to the display. Non-echoing keystrokes (a bare
  // modifier chord, Escape, arrows, ...) never taint the buffer: they render
  // nothing in the field, so there is nothing for the popup to leak.
  private bufferTouchedInput = false;

  constructor(
    private readonly registry: ShortcutRegistry,
    private readonly options: MatcherOptions,
  ) {}

  /** Feeds one `keydown` through the matcher, advancing, firing, or aborting the sequence. */
  handleKeyDown(event: KeyboardEvent): void {
    if (isModifierOnlyEvent(event)) return;

    // An event crossing an open shadow boundary is retargeted to the host, so
    // `event.target` would hide the real <input>. composedPath()[0] is the
    // un-retargeted origin, and equals event.target outside shadow DOM.
    const eventTarget =
      typeof event.composedPath === 'function'
        ? (event.composedPath()[0] ?? event.target)
        : event.target;

    const key = eventToCanonical(event);
    const prospective = [...this.buffer, key];
    const prospectiveKeys = prospective.join(' ');

    const leaf = this.registry.getActive(prospectiveKeys);

    // Escape cancels a partial sequence unless an explicit Escape leaf is
    // registered for the prospective sequence.
    if (this.buffer.length > 0 && key === 'Escape' && !leaf) {
      this.cancel();
      return;
    }
    const hasCandidates = this.registry.hasCandidates(prospectiveKeys);

    if (leaf && !hasCandidates) {
      // Pure leaf — fire immediately, respecting input guard.
      this.clearTimer();
      if (!leaf.enableOnInputs && isInputTarget(eventTarget)) {
        this.resetBuffer();
        return;
      }
      try {
        this.options.onFire(leaf, event);
      } finally {
        this.resetBuffer();
      }
      return;
    }

    if (leaf && hasCandidates) {
      // Leaf-AND-prefix — commit buffer, start timer to fire leaf if no continuation.
      this.commitBuffer(prospective, isInputTarget(eventTarget) && echoesCharacter(event));
      this.clearTimer();
      // Mirror the prefix-only branch: if the popup is already up it must
      // track the buffer, or it advertises the PREVIOUS prefix's candidates
      // for the whole timeout window — keys that would now abort the
      // sequence. Same input-echo latch applies: never paint a buffer that
      // echoed characters into a text field.
      if (this.popupVisible) {
        if (this.bufferTouchedInput) {
          // Mirror the prefix-only branch: a tainted buffer must not merely
          // stop refreshing, it must clear what is already on screen.
          // Skipping the refresh alone left untainted content displayed
          // until some later terminal outcome reached resetBuffer — a
          // window bounded only by chain depth x timeoutMs, not by design.
          this.popupVisible = false;
          this.options.onHidePopup();
        } else {
          this.options.onShowPopup({ currentSequence: [...this.buffer] });
        }
      }
      const fireTarget = eventTarget;
      // Fire the ORIGINAL event, never a synthesized one. A `new
      // KeyboardEvent(...)` that is never dispatched has target === null,
      // is not cancelable, and has all modifier flags false — so an
      // identical handler would behave differently purely because this
      // shortcut also happens to be a prefix. (This branch's fire always
      // happens inside the setTimeout below, after the original dispatch
      // has already completed, so calling preventDefault() here — on
      // either event — no longer affects any default action either way;
      // the difference this makes is target/cancelable/modifier-flag
      // fidelity, not preventDefault's effect.)
      const fireEvent = event;
      this.timer = setTimeout(() => {
        if (!leaf.enableOnInputs && isInputTarget(fireTarget)) {
          this.resetBuffer();
          return;
        }
        try {
          this.options.onFire(leaf, fireEvent);
        } finally {
          this.resetBuffer();
        }
      }, this.options.timeoutMs);
      return;
    }

    if (!leaf && hasCandidates) {
      // Prefix-only — commit buffer, start timer to show popup.
      this.commitBuffer(prospective, isInputTarget(eventTarget) && echoesCharacter(event));
      this.clearTimer();
      // Never surface buffered keystrokes that echoed a character into a text
      // field: the characters themselves would be rendered on screen.
      // commitBuffer above latches bufferTouchedInput whenever the buffer
      // holds such a key, regardless of which branch committed it, so this
      // check covers keys buffered via the leaf-AND-prefix branch too. The
      // buffer commit itself still stands, so a deeper enableOnInputs:true
      // leaf can still complete and fire — only the popup's display is
      // suppressed. If the popup was already showing an earlier (untainted)
      // prefix, hide it now instead of leaving a stale chip on screen for the
      // rest of this buffer.
      if (this.bufferTouchedInput) {
        if (this.popupVisible) {
          this.popupVisible = false;
          this.options.onHidePopup();
        }
        return;
      }
      if (this.popupVisible) {
        // Already visible — refresh immediately as the buffer changed.
        this.options.onShowPopup({ currentSequence: [...this.buffer] });
      } else {
        this.timer = setTimeout(() => {
          // Maintain clearTimer()'s invariant: a non-null this.timer means a
          // timer is still pending. This one just fired.
          this.timer = null;
          this.popupVisible = true;
          this.options.onShowPopup({ currentSequence: [...this.buffer] });
        }, this.options.timeoutMs);
      }
      return;
    }

    // Nothing matches — abort.
    this.resetBuffer();
  }

  /** Drops the pending sequence, clears the timer, and hides the popup. */
  cancel(): void {
    this.resetBuffer();
  }

  private commitBuffer(next: string[], taints: boolean): void {
    this.buffer = next;
    // Latch once true; a call site passes `taints: true` only when this key
    // was both typed into a text field and would have echoed a character
    // there (see `echoesCharacter`). Once latched, the whole buffer is
    // tainted until the next resetBuffer(), regardless of which branch
    // (leaf-AND-prefix or prefix-only) committed it.
    if (taints) this.bufferTouchedInput = true;
  }

  private resetBuffer(): void {
    this.buffer = [];
    this.clearTimer();
    this.popupVisible = false;
    this.bufferTouchedInput = false;
    this.options.onHidePopup();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
