import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { WhichKeyProvider, useShortcut, useShortcutGroup } from '../index';
import { ShortcutCheatsheet } from '../ShortcutCheatsheet';

const Setup = () => {
  useShortcutGroup('g', { description: 'Focus widget' });
  useShortcut('g n', () => {}, { description: 'Focus Notes' });
  useShortcut('g s', () => {}, { description: 'Focus Skills' });
  useShortcut('Ctrl+K', () => {}, { description: 'Command palette' });
  return null;
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
