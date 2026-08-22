import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { useShortcut } from '../useShortcut';
import { resetNoProviderWarnings } from '../context';

const Bound = ({
  onFire,
  opts,
}: {
  onFire: () => void;
  opts?: Parameters<typeof useShortcut>[2];
}) => {
  useShortcut('a', onFire, opts);
  return null;
};

describe('useShortcut', () => {
  beforeEach(() => resetNoProviderWarnings());

  it('registers on mount and fires for the key', () => {
    const handler = vi.fn();
    render(
      <WhichKeyProvider>
        <Bound onFire={handler} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('unregisters on unmount', () => {
    const handler = vi.fn();
    const { unmount } = render(
      <WhichKeyProvider>
        <Bound onFire={handler} />
      </WhichKeyProvider>,
    );
    unmount();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps the latest handler closure even when re-rendered without re-registering', () => {
    const log: number[] = [];
    const Outer = () => {
      const [n, setN] = useState(0);
      useShortcut('a', () => log.push(n));
      return <button onClick={() => setN((x) => x + 1)} data-testid="b" />;
    };
    const { getByTestId } = render(
      <WhichKeyProvider>
        <Outer />
      </WhichKeyProvider>,
    );
    act(() => {
      getByTestId('b').click();
      getByTestId('b').click();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(log).toEqual([2]);
  });

  it('parses non-canonical user input into canonical form', () => {
    const handler = vi.fn();
    const Mod = () => {
      useShortcut('Shift+Ctrl+P', handler);
      return null;
    };
    render(
      <WhichKeyProvider>
        <Mod />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }),
      );
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('LIFO override: a later mount overrides an earlier one', () => {
    const first = vi.fn();
    const second = vi.fn();
    const Both = () => (
      <>
        <Bound onFire={first} />
        <Bound onFire={second} />
      </>
    );
    render(
      <WhichKeyProvider>
        <Both />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it('options.enabled=false skips this entry — older one still active', () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <WhichKeyProvider>
        <Bound onFire={first} />
        <Bound onFire={second} opts={{ enabled: false }} />
      </WhichKeyProvider>,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('warns and no-ops outside a provider', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = vi.fn();
    render(<Bound onFire={handler} />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(handler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('outside <WhichKeyProvider>'));
    warn.mockRestore();
  });

  it('does not tear down the consumer tree when the key string is invalid [B14]', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const Child = () => {
      useShortcut('Hyper+K', () => {});
      return <div data-testid="alive">ok</div>;
    };
    let result: ReturnType<typeof render> | undefined;
    expect(() => {
      result = render(
        <WhichKeyProvider>
          <Child />
        </WhichKeyProvider>,
      );
    }).not.toThrow();
    expect(result!.getByTestId('alive')).toBeInTheDocument();
    warn.mockRestore();
  });
});
