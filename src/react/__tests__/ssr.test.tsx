/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createWhichKey } from '../../engine';
import { WhichKeyProvider } from '../WhichKeyProvider';
import { WhichKeyPopup } from '../WhichKeyPopup';
import { ShortcutCheatsheet } from '../ShortcutCheatsheet';

describe('server-side rendering', () => {
  it('createWhichKey does not touch document at construction time', () => {
    expect(typeof document).toBe('undefined');
    expect(() => createWhichKey()).not.toThrow();
  });

  it('renders the documented quick-start tree without a DOM', () => {
    const html = renderToString(
      <WhichKeyProvider>
        <WhichKeyPopup />
        <ShortcutCheatsheet />
        <span>app content</span>
      </WhichKeyProvider>,
    );
    expect(html).toContain('app content');
    expect(html).not.toContain('whichkey-popup');
    expect(html).not.toContain('whichkey-cheatsheet');
  });

  it('start() is a no-op when there is no document and no explicit target', () => {
    const wk = createWhichKey();
    expect(() => { wk.start(); wk.stop(); }).not.toThrow();
  });
});
