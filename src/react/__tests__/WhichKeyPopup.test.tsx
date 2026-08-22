import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { WhichKeyProvider, useShortcut } from '../index';
import { WhichKeyPopup } from '../WhichKeyPopup';
import { resetNoProviderWarnings } from '../context';

afterEach(() => {
  vi.useRealTimers();
});

const Setup = () => {
  useShortcut('g n', () => {}, { description: 'Focus Notes' });
  useShortcut('g s', () => {}, { description: 'Focus Skills' });
  return null;
};

describe('WhichKeyPopup', () => {
  it('renders nothing when popup state is hidden', () => {
    const { container } = render(
      <WhichKeyProvider>
        <Setup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    expect(container.querySelector('[data-testid="whichkey-popup"]')).toBeNull();
  });

  it('renders candidates when visible', () => {
    vi.useFakeTimers();
    const { getByTestId, queryByTestId } = render(
      <WhichKeyProvider timeoutMs={200}>
        <Setup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const popup = getByTestId('whichkey-popup');
    expect(popup).toBeInTheDocument();
    expect(popup.textContent).toContain('Focus Notes');
    expect(popup.textContent).toContain('Focus Skills');
    expect(popup.textContent).toContain('n');
    expect(popup.textContent).toContain('s');
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
  });

  it('shows the current sequence', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={100}>
        <Setup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(getByTestId('whichkey-popup-sequence').textContent).toContain('g');
  });

  // Brief-required assertion: popup has wk-popup class
  it('popup root has class wk-popup', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup')).toHaveClass('wk-popup');
  });
});

describe('WhichKeyPopup props (clamping)', () => {
  it('accepts layout, maxRows, and backgroundOpacity props without crashing', () => {
    const { container } = render(
      <WhichKeyProvider>
        <WhichKeyPopup layout="vertical" maxRows={5} backgroundOpacity={0.95} />
      </WhichKeyProvider>,
    );
    expect(container).toBeTruthy();
  });

  it('applies data-layout="vertical" by default', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup').getAttribute('data-layout')).toBe('vertical');
  });

  it('applies the default backgroundOpacity (0.95) as inline rgba', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const popup = getByTestId('whichkey-popup');
    expect(popup.style.backgroundColor).toBe('rgba(17, 24, 39, 0.95)');
  });

  it('honors a custom backgroundOpacity on the vertical layout', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup backgroundOpacity={0.5} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup').style.backgroundColor).toBe('rgba(17, 24, 39, 0.5)');
  });

  it('clamps backgroundOpacity above 1 down to 1', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup backgroundOpacity={1.5} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // jsdom's CSSOM normalizes `rgba(r, g, b, 1)` to `rgb(r, g, b)` when read back
    // via element.style.backgroundColor. The implementation outputs the rgba form.
    expect(getByTestId('whichkey-popup').style.backgroundColor).toBe('rgb(17, 24, 39)');
  });

  it('clamps backgroundOpacity below 0 up to 0', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup backgroundOpacity={-0.2} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup').style.backgroundColor).toBe('rgba(17, 24, 39, 0)');
  });

  it('renders horizontal layout with data-layout="horizontal" and wk-popup--horizontal class', () => {
    // ADAPTED: old test asserted Tailwind classes 'left-1/2', '-translate-x-1/2', and absence of 'right-4'.
    // New test asserts the wk-* class that provides the same centering/positioning behaviour.
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const popup = getByTestId('whichkey-popup');
    expect(popup.getAttribute('data-layout')).toBe('horizontal');
    // ADAPTED: wk-popup--horizontal replaces the Tailwind left-1/2 + -translate-x-1/2 utilities
    expect(popup.className).toContain('wk-popup--horizontal');
    // ADAPTED: absence of wk-popup--vertical replaces absence of right-4
    expect(popup.className).not.toContain('wk-popup--vertical');
  });

  it('renders the candidate grid with column-major flow and 5 rows by default', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const grid = getByTestId('whichkey-popup-grid');
    expect(grid).toHaveClass('wk-popup__grid');
    expect(grid.style.gridTemplateRows).toBe('repeat(5, auto)');
  });

  it('honors a custom maxRows', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" maxRows={3} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup-grid').style.gridTemplateRows).toBe('repeat(3, auto)');
  });

  it('clamps maxRows of 0 to 1', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" maxRows={0} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup-grid').style.gridTemplateRows).toBe('repeat(1, auto)');
  });

  it('floors fractional maxRows', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" maxRows={3.7} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup-grid').style.gridTemplateRows).toBe('repeat(3, auto)');
  });

  it('renders candidates and sequence in horizontal layout', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const popup = getByTestId('whichkey-popup');
    expect(popup.textContent).toContain('Focus Notes');
    expect(popup.textContent).toContain('Focus Skills');
    expect(popup.textContent).toContain('n');
    expect(popup.textContent).toContain('s');
    expect(getByTestId('whichkey-popup-sequence').textContent).toContain('g');
  });

  it('honors backgroundOpacity in horizontal layout', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <Setup />
        <WhichKeyPopup layout="horizontal" backgroundOpacity={0.7} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup').style.backgroundColor).toBe('rgba(17, 24, 39, 0.7)');
  });

  // Brief-required assertion: a group candidate row carries the group modifier.
  // Covered in full by the dedicated describe block below; this is a smoke test
  // confirming the prop interface does not crash on a leaf-only popup.
  it('does not crash when rendering only leaf candidates', () => {
    vi.useFakeTimers();
    const GroupSetup = () => {
      useShortcut('g n', () => {}, { description: 'Notes' });
      useShortcut('g s', () => {}, { description: 'Skills' });
      return null;
    };
    const { getByTestId } = render(
      <WhichKeyProvider timeoutMs={50}>
        <GroupSetup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId('whichkey-popup')).toBeInTheDocument();
  });
});

describe('WhichKeyPopup — wk-row--group class (brief requirement)', () => {
  it('emits wk-row--group when a candidate is a group', () => {
    // Register shortcuts under two different top-level keys so the engine
    // shows them as group candidates when no sequence is active yet.
    // Dispatch a key that has multiple sub-shortcuts to expose a group candidate.
    // Strategy: register 'a b' and 'a c' — pressing 'a' shows b and c as leaves.
    // To get isGroup=true we need a candidate that is itself a prefix with children.
    // Register 'g n' and 'h m' — these are two sibling groups.
    // But we want a candidate where isGroup=true. That happens when the popup
    // shows at the top level (no key pressed yet, with timeout=0 being impossible).
    // Actually the engine only shows popup on partial sequences, so the first
    // key pressed shows its children. Those children are isGroup=true only if
    // they themselves have sub-shortcuts. So: register 'g n m' and 'g n k',
    // then press 'g' to get a popup showing 'n' as an isGroup candidate.
    vi.useFakeTimers();
    const DeepSetup = () => {
      useShortcut('g n m', () => {}, { description: 'Deeper 1' });
      useShortcut('g n k', () => {}, { description: 'Deeper 2' });
      return null;
    };
    const { container } = render(
      <WhichKeyProvider timeoutMs={50}>
        <DeepSetup />
        <WhichKeyPopup />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // 'n' should be an isGroup candidate because it has sub-shortcuts
    expect(container.querySelector('.wk-row--group')).not.toBeNull();
  });

  it('announces as a polite live region, not a dialog', () => {
    vi.useFakeTimers();
    const { getByTestId } = render(
      <WhichKeyProvider><Setup /><WhichKeyPopup /></WhichKeyProvider>,
    );
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' })); });
    act(() => { vi.advanceTimersByTime(600); });
    const popup = getByTestId('whichkey-popup');
    expect(popup).toHaveAttribute('role', 'status');
    expect(popup).toHaveAttribute('aria-live', 'polite');
    expect(popup).toHaveAttribute('aria-atomic', 'true');
    expect(popup).not.toHaveAttribute('role', 'dialog');
  });
});

describe('WhichKeyPopup outside a provider [B24]', () => {
  beforeEach(() => resetNoProviderWarnings());

  it('warns naming the component instead of failing silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<WhichKeyPopup />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<WhichKeyPopup>'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<WhichKeyProvider>'));
    warn.mockRestore();
  });

  it('warns once per mount, not once per render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<WhichKeyPopup />);
    rerender(<WhichKeyPopup layout="horizontal" />);
    rerender(<WhichKeyPopup maxRows={3} />);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  // Distinct from the "once per render" test above: rerender() keeps the same
  // component instance alive, so React's own effect-dependency comparison
  // (stable engine/what) is what suppresses re-firing there — the module-level
  // Set is never consulted. Unmounting and mounting a brand-new instance is
  // the only way to force a second, independent effect run and actually
  // exercise the cross-mount dedupe the Set exists for.
  it('warns exactly once across an unmount + remount, not once per mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = render(<WhichKeyPopup />);
    unmount();
    render(<WhichKeyPopup />);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
