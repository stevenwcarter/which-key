import { eventToCanonical, isInputTarget, isModifierOnlyEvent } from './keys';
import type { ShortcutRegistry } from './registry';
import type { ShortcutEntry } from './types';

export type MatcherOptions = {
  timeoutMs: number;
  onFire: (entry: ShortcutEntry, event: KeyboardEvent) => void;
  onShowPopup: (state: { currentSequence: string[] }) => void;
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

  handleKeyDown(event: KeyboardEvent): void {
    if (isModifierOnlyEvent(event)) return;

    // An event crossing an open shadow boundary is retargeted to the host, so
    // `event.target` would hide the real <input>. composedPath()[0] is the
    // un-retargeted origin, and equals event.target outside shadow DOM.
    const eventTarget =
      typeof event.composedPath === 'function' ? (event.composedPath()[0] ?? event.target) : event.target;

    const key = eventToCanonical(event);
    const prospective = [...this.buffer, key];
    const prospectiveKeys = prospective.join(' ');

    // Escape cancels a partial sequence unless an explicit Escape leaf is registered for the prospective.
    if (this.buffer.length > 0 && key === 'Escape') {
      const escapeLeaf = this.registry.getActive(prospectiveKeys);
      if (!escapeLeaf) {
        this.cancel();
        return;
      }
    }

    const leaf = this.registry.getActive(prospectiveKeys);
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
      if (this.popupVisible && !this.bufferTouchedInput) {
        this.options.onShowPopup({ currentSequence: [...this.buffer] });
      }
      const fireTarget = eventTarget;
      // Fire the ORIGINAL event, never a synthesized one. A `new
      // KeyboardEvent(...)` that is never dispatched has target === null,
      // cancelable === false (so preventDefault() silently no-ops) and all
      // modifier flags false — so an identical handler would behave
      // differently purely because this shortcut also happens to be a prefix.
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
          this.popupVisible = true;
          this.options.onShowPopup({ currentSequence: [...this.buffer] });
        }, this.options.timeoutMs);
      }
      return;
    }

    // Nothing matches — abort.
    this.resetBuffer();
  }

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
