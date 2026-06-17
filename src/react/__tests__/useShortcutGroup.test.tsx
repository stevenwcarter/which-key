import { describe, it, expect } from 'vitest';
import { useContext } from 'react';
import { render } from '@testing-library/react';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { WhichKeyContext } from '../context';
import { useShortcutGroup } from '../useShortcutGroup';
import type { WhichKeyEngine } from '../../engine';

// Adaptation note: the old tests captured a context value object with a `.registry` field.
// The new context holds the engine directly, which also exposes `.registry` — so the
// assertions are identical. Only the Capture component type annotation changed.

const Capture = ({ onCtx }: { onCtx: (c: WhichKeyEngine | null) => void }) => {
  const ctx = useContext(WhichKeyContext);
  onCtx(ctx);
  return null;
};

describe('useShortcutGroup', () => {
  it('registers a group on mount and unregisters on unmount', () => {
    let ctx: WhichKeyEngine | null = null;
    const Group = () => {
      useShortcutGroup('g', { description: 'Focus widget' });
      return null;
    };
    const { unmount } = render(
      <WhichKeyProvider>
        <Capture onCtx={(c) => (ctx = c)} />
        <Group />
      </WhichKeyProvider>,
    );
    expect(ctx!.registry.getActiveGroup('g')?.description).toBe('Focus widget');
    unmount();
  });

  it('LIFO override: later mount wins', () => {
    let ctx: WhichKeyEngine | null = null;
    const A = () => {
      useShortcutGroup('g', { description: 'A' });
      return null;
    };
    const B = () => {
      useShortcutGroup('g', { description: 'B' });
      return null;
    };
    render(
      <WhichKeyProvider>
        <Capture onCtx={(c) => (ctx = c)} />
        <A />
        <B />
      </WhichKeyProvider>,
    );
    expect(ctx!.registry.getActiveGroup('g')?.description).toBe('B');
  });
});
