import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { WhichKeyLayer } from '../WhichKeyLayer';
import { useShortcut } from '../useShortcut';

const Shortcut = ({ k, fn }: { k: string; fn: () => void }) => {
  useShortcut(k, fn);
  return null;
};

describe('<WhichKeyLayer>', () => {
  it('exclusive layer suppresses an outer shortcut while mounted', () => {
    const base = vi.fn();
    const { rerender } = render(
      <WhichKeyProvider helpKey={null}>
        <Shortcut k="a" fn={base} />
        <WhichKeyLayer exclusive>
          <span />
        </WhichKeyLayer>
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'a' });
    expect(base).not.toHaveBeenCalled();

    // Unmount the layer → base reachable again
    rerender(
      <WhichKeyProvider helpKey={null}>
        <Shortcut k="a" fn={base} />
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'a' });
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('a shortcut declared inside the layer fires and is gone after unmount', () => {
    const modal = vi.fn();
    const { rerender } = render(
      <WhichKeyProvider helpKey={null}>
        <WhichKeyLayer exclusive>
          <Shortcut k="b" fn={modal} />
        </WhichKeyLayer>
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'b' });
    expect(modal).toHaveBeenCalledTimes(1);

    rerender(<WhichKeyProvider helpKey={null} />);
    fireEvent.keyDown(document, { key: 'b' });
    expect(modal).toHaveBeenCalledTimes(1); // not called again
  });

  it('nested layers each raise the level, so an exclusive inner layer wins over outer-layer and base shortcuts', () => {
    const base = vi.fn();
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <WhichKeyProvider helpKey={null}>
        <Shortcut k="a" fn={base} />
        <WhichKeyLayer>
          <Shortcut k="a" fn={outer} />
          <WhichKeyLayer exclusive>
            <Shortcut k="a" fn={inner} />
          </WhichKeyLayer>
        </WhichKeyLayer>
      </WhichKeyProvider>,
    );
    fireEvent.keyDown(document, { key: 'a' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(base).not.toHaveBeenCalled();
  });

  it('StrictMode double-mount does not leak layers — outer shortcut suppressed exactly once, inner fires exactly once per keypress', () => {
    const base = vi.fn();
    const modal = vi.fn();
    render(
      <StrictMode>
        <WhichKeyProvider helpKey={null}>
          <Shortcut k="a" fn={base} />
          <WhichKeyLayer exclusive>
            <Shortcut k="b" fn={modal} />
          </WhichKeyLayer>
        </WhichKeyProvider>
      </StrictMode>,
    );

    // Outer shortcut 'a' must be suppressed (exclusive layer is active)
    fireEvent.keyDown(document, { key: 'a' });
    expect(base).not.toHaveBeenCalled();

    // Inner shortcut 'b' must fire exactly once (not doubly-registered)
    fireEvent.keyDown(document, { key: 'b' });
    expect(modal).toHaveBeenCalledTimes(1);
  });
});
