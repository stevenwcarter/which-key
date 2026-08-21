import { eventToCanonical, isInputTarget, isModifierOnlyEvent } from './keys';
import type { ShortcutRegistry } from './registry';
import type { ShortcutEntry } from './types';

export type MatcherOptions = {
  timeoutMs: number;
  onFire: (entry: ShortcutEntry, event: KeyboardEvent) => void;
  onShowPopup: (state: { currentSequence: string[] }) => void;
  onHidePopup: () => void;
};

export class Matcher {
  private buffer: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private popupVisible = false;
  // Once any keystroke in the current buffer was typed into a text field,
  // the popup must stay suppressed for the rest of this buffer — even after
  // focus moves outside the field — so a later outside-field keystroke never
  // flushes the buffered field characters to the display.
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
      this.commitBuffer(prospective, isInputTarget(eventTarget));
      this.clearTimer();
      const fireTarget = eventTarget;
      this.timer = setTimeout(() => {
        if (!leaf.enableOnInputs && isInputTarget(fireTarget)) {
          this.resetBuffer();
          return;
        }
        const synthetic = new KeyboardEvent('keydown', { key });
        try {
          this.options.onFire(leaf, synthetic);
        } finally {
          this.resetBuffer();
        }
      }, this.options.timeoutMs);
      return;
    }

    if (!leaf && hasCandidates) {
      // Prefix-only — commit buffer, start timer to show popup.
      this.commitBuffer(prospective, isInputTarget(eventTarget));
      this.clearTimer();
      // Never surface buffered keystrokes that were typed into a text field:
      // the characters themselves would be rendered on screen. commitBuffer
      // above latches bufferTouchedInput whenever the buffer holds a
      // field-typed key, regardless of which branch committed it, so this
      // check covers keys buffered via the leaf-AND-prefix branch too. The
      // buffer commit itself still stands, so a deeper enableOnInputs:true
      // leaf can still complete and fire — only the popup's display is
      // suppressed.
      if (this.bufferTouchedInput) return;
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

  private commitBuffer(next: string[], fromInput: boolean): void {
    this.buffer = next;
    // Latch once true; a key committed while focus was in a field taints the
    // whole buffer until the next resetBuffer(), regardless of which branch
    // (leaf-AND-prefix or prefix-only) committed it.
    if (fromInput) this.bufferTouchedInput = true;
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
