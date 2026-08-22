import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, act } from '@testing-library/react';
import { WhichKeyProvider, useShortcut, useShortcutGroup, createWhichKey } from '../index';
import type { WhichKeyEngine } from '../index';
import { ShortcutCheatsheet } from '../ShortcutCheatsheet';
import { resetNoProviderWarnings, WhichKeyContext } from '../context';

const Setup = () => {
  useShortcutGroup('g', { description: 'Focus widget' });
  useShortcut('g n', () => {}, { description: 'Focus Notes' });
  useShortcut('g s', () => {}, { description: 'Focus Skills' });
  useShortcut('Ctrl+K', () => {}, { description: 'Command palette' });
  return null;
};

// D1's engine is created directly (bypassing <WhichKeyProvider>, which owns
// its engine internally and never exposes it) so the test can hold a
// reference to call `wk.register(...)` and spy `wk.getCheatsheetModel` after
// the sheet is already open. `rerender` re-wraps in the same context Provider
// so each call simulates a parent re-render without losing the engine.
const renderOpenCheatsheet = (wk: WhichKeyEngine) => {
  const utils = render(
    <WhichKeyContext.Provider value={wk}>
      <ShortcutCheatsheet />
    </WhichKeyContext.Provider>,
  );
  act(() => {
    wk.openCheatsheet();
  });
  return {
    ...utils,
    rerender: (ui: ReactElement) =>
      utils.rerender(<WhichKeyContext.Provider value={wk}>{ui}</WhichKeyContext.Provider>),
  };
};

describe('ShortcutCheatsheet', () => {
  it('is hidden initially', () => {
    const { queryByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
  });

  it('shows when ? is pressed and lists every active shortcut', () => {
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    const cs = getByTestId('whichkey-cheatsheet');
    expect(cs.textContent).toContain('Focus Notes');
    expect(cs.textContent).toContain('Focus Skills');
    expect(cs.textContent).toContain('Command palette');
    expect(cs.textContent).toContain('g n');
    expect(cs.textContent).toContain('Ctrl+K');
  });

  it('closes when Escape is pressed', () => {
    const { queryByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(queryByTestId('whichkey-cheatsheet')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
  });

  it('closes when the backdrop is clicked', () => {
    const { queryByTestId, getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    act(() => {
      getByTestId('whichkey-cheatsheet-backdrop').click();
    });
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
  });

  it('renders single-letter shortcuts at the top level instead of nested under their own letter', () => {
    const Seeded = () => {
      useShortcut('q', () => {}, { description: 'Quit' });
      useShortcut('g n', () => {}, { description: 'Notes' });
      return null;
    };
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Seeded />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    const cs = getByTestId('whichkey-cheatsheet');
    const sections = Array.from(cs.querySelectorAll('section'));
    for (const section of sections) {
      expect(section.textContent).not.toContain('Quit');
    }
    expect(cs.textContent).toContain('Quit');
    expect(sections.some((s) => s.textContent?.includes('Notes'))).toBe(true);
  });

  it('orders entries within a group alphabetically when sortKeys="alphabetical"', () => {
    const Seeded = () => {
      useShortcut('g s', () => {}, { description: 'Skills' });
      useShortcut('g a', () => {}, { description: 'Abilities' });
      useShortcut('g n', () => {}, { description: 'Notes' });
      return null;
    };
    const { getByTestId } = render(
      <WhichKeyProvider sortKeys="alphabetical">
        <Seeded />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    const cs = getByTestId('whichkey-cheatsheet');
    const orderedDescriptions = Array.from(cs.querySelectorAll('li span')).map(
      (s) => s.textContent,
    );
    expect(orderedDescriptions).toEqual(['Abilities', 'Notes', 'Skills']);
  });

  it('does not render the internal default-help entry ("Toggle keyboard shortcuts")', () => {
    // The engine auto-registers __whichkey_default_help__ when helpKey is set.
    // The cheatsheet must filter it out — this test would fail if the filter
    // in controller.ts (line: getAllActive().filter(e => e.id !== DEFAULT_HELP_ID))
    // were removed.
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    const cs = getByTestId('whichkey-cheatsheet');
    // Normal shortcuts must be present (proves the cheatsheet rendered)
    expect(cs.textContent).toContain('Focus Notes');
    // The internal help-toggle entry must NOT appear
    expect(cs.textContent).not.toContain('Toggle keyboard shortcuts');
  });

  // Brief-required assertion: cheatsheet root has class wk-cheatsheet
  it('cheatsheet root has class wk-cheatsheet', () => {
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }));
    });
    expect(getByTestId('whichkey-cheatsheet')).toHaveClass('wk-cheatsheet');
  });
});

describe('cheatsheet focus management', () => {
  it('marks the panel as a modal dialog labelled by its title', () => {
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    const panel = getByTestId('whichkey-cheatsheet');
    expect(panel).toHaveAttribute('aria-modal', 'true');
    expect(panel).toHaveAttribute('aria-labelledby', 'wk-cheatsheet-title');
    expect(document.getElementById('wk-cheatsheet-title')).not.toBeNull();
  });

  it('moves focus into the panel on open and restores it on close', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(getByTestId('whichkey-cheatsheet').contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('restores focus to a focused SVGElement on close (not just HTMLElement)', () => {
    // document.activeElement is Element | null; an SVGElement with a
    // tabindex can genuinely be the active element and its .focus() works —
    // the restore path must not silently narrow it away to null.
    const trigger = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    trigger.setAttribute('tabindex', '0');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { getByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    expect(getByTestId('whichkey-cheatsheet').contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('exposes a keyboard-reachable close button that closes the sheet', () => {
    const { getByTestId, getByLabelText, queryByTestId } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    const close = getByLabelText('Close keyboard shortcuts');
    expect(getByTestId('whichkey-cheatsheet').contains(close)).toBe(true);
    act(() => {
      close.click();
    });
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
  });

  it('Tab-cycles focus among focusable descendants, wrapping at both ends', () => {
    const { getByTestId, getByLabelText } = render(
      <WhichKeyProvider>
        <Setup />
        <ShortcutCheatsheet />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    });
    const panel = getByTestId('whichkey-cheatsheet');
    const close = getByLabelText('Close keyboard shortcuts');

    // The panel ships exactly one focusable descendant (the close button).
    // Append a second so forward/backward wrap is exercised on a genuine
    // two-item cycle instead of trivially re-focusing the same element.
    const second = document.createElement('button');
    second.type = 'button';
    second.textContent = 'second';
    panel.appendChild(second);

    // Forward Tab from the last item (second) wraps to the first (close).
    act(() => {
      second.focus();
    });
    expect(document.activeElement).toBe(second);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(close);

    // Shift+Tab from the first item (close) wraps to the last (second).
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(second);

    // Shift+Tab while focus sits on the panel itself also wraps to the last —
    // this is the case the `active === panel` branch exists to cover.
    act(() => {
      panel.focus();
    });
    expect(document.activeElement).toBe(panel);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(second);
  });
});

describe('ShortcutCheatsheet outside a provider [B24]', () => {
  beforeEach(() => resetNoProviderWarnings());

  it('warns when mounted outside a provider [B24]', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ShortcutCheatsheet />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<ShortcutCheatsheet>'));
    warn.mockRestore();
  });
});

describe('ShortcutCheatsheet model memoisation [D1]', () => {
  it('does not rebuild the cheatsheet model when the registry has not changed [D1]', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('q', vi.fn(), { description: 'Quit' });
    const spy = vi.spyOn(wk, 'getCheatsheetModel');

    const { rerender } = renderOpenCheatsheet(wk);
    const afterFirst = spy.mock.calls.length;

    rerender(<ShortcutCheatsheet />);
    rerender(<ShortcutCheatsheet />);
    expect(spy.mock.calls.length).toBe(afterFirst);
  });

  it('rebuilds when a late registration changes the registry [D1]', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('q', vi.fn(), { description: 'Quit' });
    const { rerender, getByTestId } = renderOpenCheatsheet(wk);

    act(() => {
      wk.register('n', vi.fn(), { description: 'New' });
    });
    rerender(<ShortcutCheatsheet />);
    expect(getByTestId('whichkey-cheatsheet').textContent).toContain('New');
  });

  // Load-bearing: fails against the pre-fix code, where the useMemo factory
  // called engine.getCheatsheetModel() unconditionally and only `visible`'s
  // *value* (not a gate inside the factory) affected the result — so a
  // registry mutation on a CLOSED sheet (e.g. a sibling layer's
  // activateLayer(), which bumps registry.version and emit()s) still ran a
  // full model build every render, with nothing ever shown for it.
  it('does not build the model while the sheet is closed, even when the registry changes [D1]', () => {
    const wk = createWhichKey({ helpKey: null });
    const spy = vi.spyOn(wk, 'getCheatsheetModel');
    const { rerender, queryByTestId } = render(
      <WhichKeyContext.Provider value={wk}>
        <ShortcutCheatsheet />
      </WhichKeyContext.Provider>,
    );
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      wk.register('n', vi.fn(), { description: 'New' });
      wk.activateLayer(1, true);
    });
    rerender(
      <WhichKeyContext.Provider value={wk}>
        <ShortcutCheatsheet />
      </WhichKeyContext.Provider>,
    );

    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
