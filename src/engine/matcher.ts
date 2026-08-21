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

  constructor(
    private readonly registry: ShortcutRegistry,
    private readonly options: MatcherOptions,
  ) {}

  handleKeyDown(event: KeyboardEvent): void {
    if (isModifierOnlyEvent(event)) return;
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
      if (!leaf.enableOnInputs && isInputTarget(event.target)) {
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
      this.commitBuffer(prospective);
      this.clearTimer();
      const fireTarget = event.target;
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
      this.commitBuffer(prospective);
      this.clearTimer();
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

  private commitBuffer(next: string[]): void {
    this.buffer = next;
  }

  private resetBuffer(): void {
    this.buffer = [];
    this.clearTimer();
    this.popupVisible = false;
    this.options.onHidePopup();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
