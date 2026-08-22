# code-health B1–B13 (Critical + High) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 13 highest-impact findings from the code-health audit (all Critical + all High) in `which-key`, each with a regression test and its own commit.

**Architecture:** `which-key` is a published TypeScript library with three entry points: a framework-free engine (`src/engine/`), a React binding (`src/react/`), and an imperative DOM renderer (`src/vanilla/`). React and vanilla are two interchangeable *renderers* over one engine; neither holds state. Most fixes here land in the engine (`controller.ts`, `matcher.ts`, `registry.ts`, `keys.ts`) and must be applied **identically in both renderers** where UI is involved, or the two drift.

**Tech Stack:** TypeScript 5.7 (strict), Vitest 2.1 + jsdom + Testing Library, tsup (dual ESM/CJS), ESLint 9 flat config, React 19 (optional peer).

**Spec:** `docs/superpowers/specs/2026-08-21-codehealth-critical-high-design.md`

## Global Constraints

- **Node v24.7.0 is required.** The default-PATH nvm install (v24.19.0) is broken — missing `lib/node_modules`, so `npm` does not resolve. Every shell command must be preceded by:
  `export PATH="$HOME/.nvm/versions/node/v24.7.0/bin:$PATH"`
- **Verification command (run in full before every commit):**
  `npm run lint && npm run typecheck && npm test && npm run build`
- **Baseline at commit 3dd6ff4:** lint clean, typecheck clean, build green, **192 tests passing**, coverage 96.3% lines / 92.24% branches. The coverage gate is 80% on lines/statements/functions/branches. Never let the count drop below 192.
- **Never** use `--no-verify`, `--allow-dirty`, or `-f`. A red gate is a stop-the-line event.
- **Test files are never a fix target.** Add NEW tests. The single sanctioned exception is Task 10 (B8), which must update `src/engine/__tests__/registry.test.ts:77-85` because those assertions pin the exact warning text being corrected.
- **Every commit strips its finding's entire block from `bughunt.md`** — from the `### B<n>.` heading through the `- [ ] execute   [ ] skip` line inclusive, plus the blank line after. Non-negotiable. `bughunt.md` reflects open issues only.
- **Commit message format:** `fix(<category>): <summary> [B<n>]` for fixes, `test: characterize <unit> before fix [B<n>]` for RED characterization commits. Append the session trailer:
  `Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC`
- **Do not** touch findings B14–B43 or any of the 7 `decision-needed` markers. In particular: do not make the cheatsheet modal, do not add an `onWarn` option, do not portal the React overlays, do not change `WhichKeyLayer` level allocation, do not add eslint plugins, do not bump the version, do not publish.
- **Canonical-key invariant:** `parseKey` (registration) and `eventToCanonical` (runtime) must produce byte-identical strings. Tasks 2 and 11 touch this seam and must each land a **round-trip** test, not just a `parseKey` unit test.
- **Stable-snapshot invariant:** `getSnapshot()` must return a cached reference; returning a fresh object per call makes `useSyncExternalStore` loop forever. Task 5 changes when `emit()` fires and must not break this.
- **Engine purity:** no React import may enter `src/engine/`.

## File Structure

| File | Change | Tasks |
|---|---|---|
| `src/engine/controller.ts` | lazy `target` resolution; `onFire` error attribution; `onHidePopup` no-op guard | 1, 4, 5 |
| `src/engine/matcher.ts` | try/finally around `onFire`; `hasCandidates`; `composedPath` target; input guard on popup | 4, 6, 8, 9 |
| `src/engine/registry.ts` | new `hasCandidates()`; corrected collision warning | 6, 10 |
| `src/engine/keys.ts` | Shift-on-punctuation warning; case-insensitive modifier aliases | 2, 11 |
| `src/react/ShortcutCheatsheet.tsx` | focus management, `aria-modal`, close button | 3 |
| `src/react/WhichKeyPopup.tsx` | `role="status"` live region | 7 |
| `src/vanilla/cheatsheet.ts` | focus management, `aria-modal`, close button; returns a destroy fn | 3 |
| `src/vanilla/mount.ts` | consume the cheatsheet destroy fn | 3 |
| `src/vanilla/popup.ts` | `role="status"` live region | 7 |
| `src/styles.css` | `.wk-cheatsheet__close` rule | 3 |
| `package.json` | per-format nested `exports` conditions | 12 |
| `README.md`, `docs/API.md` | key-syntax table, CSS class contract table | 2, 13 |
| `src/react/__tests__/ssr.test.tsx` | **create** — node-env SSR smoke test | 1 |
| `src/engine/__tests__/package-exports.test.ts` | **create** — exports shape + target existence | 12 |
| `src/__tests__/class-contract.test.tsx` | **create** — emitted-class vs documented-class drift guard | 13 |

---

### Task 1: B1 — SSR crash from eager `document` dereference

**Files:**
- Create: `src/react/__tests__/ssr.test.tsx`
- Modify: `src/engine/controller.ts:81` (destructure), `src/engine/controller.ts:203-215` (`start`/`stop`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `start()` becomes the only place that touches `document`. Tasks 8 and 9 must not reintroduce a construction-time DOM dereference.

- [ ] **Step 1: Write the failing SSR test**

Create `src/react/__tests__/ssr.test.tsx`. The `@vitest-environment node` docblock is load-bearing — it removes the jsdom `document` so this reproduces a real server render. (Verified: the `src/test-setup.ts` setup file loads cleanly under the node environment.)

```tsx
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
```

- [ ] **Step 2: Run it to confirm RED**

```bash
export PATH="$HOME/.nvm/versions/node/v24.7.0/bin:$PATH"
npx vitest run src/react/__tests__/ssr.test.tsx
```
Expected: FAIL — `ReferenceError: document is not defined`.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/react/__tests__/ssr.test.tsx
git commit -m "test: characterize SSR render before fix [B1]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

- [ ] **Step 4: Make target resolution lazy**

In `src/engine/controller.ts`, change the options destructure (currently line 81):

```ts
// BEFORE
const { timeoutMs = 500, helpKey = '?', sortKeys, target = document } = options;

// AFTER
const { timeoutMs = 500, helpKey = '?', sortKeys } = options;
const explicitTarget = options.target;
let bound: Document | HTMLElement | null = null;
```

- [ ] **Step 5: Resolve the target inside start/stop**

Replace the `start` and `stop` members:

```ts
    start() {
      if (started) return;
      const resolved = explicitTarget ?? (typeof document !== 'undefined' ? document : null);
      if (resolved === null) return;
      started = true;
      bound = resolved;
      bound.addEventListener('keydown', handler);
    },
    stop() {
      if (!started) return;
      started = false;
      bound?.removeEventListener('keydown', handler);
      bound = null;
      matcher.cancel();
    },
```

- [ ] **Step 6: Verify GREEN and run the full gate**

```bash
npx vitest run src/react/__tests__/ssr.test.tsx
npm run lint && npm run typecheck && npm test && npm run build
```
Expected: SSR file passes; full suite ≥195 tests, all green.

- [ ] **Step 7: Strip B1 from bughunt.md and commit**

Delete the whole `### B1.` block (heading through its `- [ ] execute   [ ] skip` line).

```bash
git add src/engine/controller.ts bughunt.md
git commit -m "fix(correctness): resolve keydown target lazily so SSR does not crash [B1]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 2: B2 — `Shift+<punctuation>` silently binds the unshifted key

**Files:**
- Modify: `src/engine/keys.ts:36-37` (comment), `src/engine/keys.ts:105-112` (`parseKey`)
- Modify: `README.md:81`, `docs/API.md:360`
- Test: `src/engine/__tests__/keys.test.ts` (append new cases only — do not edit existing ones)

**Interfaces:**
- Consumes: nothing.
- Produces: `parseKey` gains a warning path. Task 11 also edits `parseKey`; keep the two edits in separate regions (Task 11 touches the modifier loop, this task touches the base-character handling after it).

**Decision (user-confirmed):** implement the docs-and-warn fix, **not** a US-layout glyph map. Writing the shifted character directly (`'?'`) already works on every layout because `eventToCanonical` reads `event.key` verbatim; a US map would mis-bind on other layouts (German `Shift+7` yields `/`, the map would register `&`).

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/keys.test.ts`:

```ts
describe('Shift on punctuation and digits', () => {
  it('warns that Shift is dropped and names the key it will actually match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseKey('Shift+/');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Shift+/');
    expect(warn.mock.calls[0][0]).toContain('"/"');
    warn.mockRestore();
  });

  it('does not warn when the shifted character is written directly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseKey('?');
    parseKey('Shift+?');
    parseKey('Ctrl+s');
    parseKey('Shift+A');
    parseKey('Shift+Tab');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('round-trips the documented spelling against a real Shift+/ keypress', () => {
    const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
    expect(parseKey('?')).toBe(eventToCanonical(event));
  });
});
```

Ensure `eventToCanonical` is in the file's import list from `../keys`.

- [ ] **Step 2: Run it to confirm RED**

```bash
npx vitest run src/engine/__tests__/keys.test.ts -t "Shift on punctuation"
```
Expected: the two warn tests FAIL (no warning is emitted today). The round-trip test already passes — that is fine, it is the regression pin.

- [ ] **Step 3: Add the warning to parseKey**

In `src/engine/keys.ts`, add this constant near `KNOWN_MODIFIERS`:

```ts
// US-layout characters that a Shift press turns into something else. Used only
// to decide whether to warn — never to rewrite the key, which would guess wrong
// on non-US layouts.
const SHIFT_ALTERS_US = new Set([
  '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  '-', '=', '[', ']', '\\', ';', "'", ',', '.', '/',
]);
```

Then in `parseKey`, immediately after the existing bare-uppercase-letter block and before `return buildCanonical(...)`:

```ts
  if (shift && SHIFT_ALTERS_US.has(base)) {
    console.warn(
      `[whichkey] "${input}": Shift is dropped for punctuation and digits — write the ` +
        `shifted character directly (e.g. "?" not "Shift+/"). This binding will match "${base}".`,
    );
  }
```

- [ ] **Step 4: Fix the misleading comment**

In `src/engine/keys.ts`, the casing-rules comment (around line 36-37) currently reads `- Other: drop "Shift+" — the shifted form is already in the base character (Shift+/ → ?)`. Replace that line with:

```ts
  //   - Other:     drop "Shift+" — callers must write the shifted character itself
  //                (write "?" directly; "Shift+/" canonicalizes to "/" and warns).
```

- [ ] **Step 5: Correct the two doc tables**

In `README.md`, replace the `Shift+/` row of the key-string table:

```markdown
| `?`       | The shifted character itself — write `?`, not `Shift+/` |
```

In `docs/API.md`, replace the examples line `Shift+/        →  ?  (on US keyboard layouts)` with:

```
?              →  ?  (write the shifted character directly, not "Shift+/")
```

- [ ] **Step 6: Verify GREEN and run the full gate**

```bash
npx vitest run src/engine/__tests__/keys.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 7: Strip B2 from bughunt.md and commit**

```bash
git add src/engine/keys.ts src/engine/__tests__/keys.test.ts README.md docs/API.md bughunt.md
git commit -m "fix(correctness): warn when Shift is dropped from punctuation keys [B2]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 3: B3 — cheatsheet has no focus management

**Files:**
- Modify: `src/react/ShortcutCheatsheet.tsx` (whole component)
- Modify: `src/vanilla/cheatsheet.ts` (`renderCheatsheet` signature + panel setup)
- Modify: `src/vanilla/mount.ts:37-48, 55-62` (consume the new destroy fn)
- Modify: `src/styles.css` (add `.wk-cheatsheet__close`)
- Test: `src/react/__tests__/ShortcutCheatsheet.test.tsx` (append), `src/vanilla/__tests__/mount.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `renderCheatsheet(p, model, onClose)` now returns `{ element: HTMLElement; destroy: () => void }` instead of `HTMLElement`. It is internal (not re-exported from `src/vanilla/index.ts`), so this is not a public break. Task 13's class-contract test must include the new `wk-cheatsheet__close` class.

- [ ] **Step 1: Write the failing React tests**

Append to `src/react/__tests__/ShortcutCheatsheet.test.tsx`:

```tsx
describe('cheatsheet focus management', () => {
  it('marks the panel as a modal dialog labelled by its title', () => {
    const { getByTestId } = render(
      <WhichKeyProvider><Setup /><ShortcutCheatsheet /></WhichKeyProvider>,
    );
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); });
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
      <WhichKeyProvider><Setup /><ShortcutCheatsheet /></WhichKeyProvider>,
    );
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); });
    expect(getByTestId('whichkey-cheatsheet').contains(document.activeElement)).toBe(true);

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('exposes a keyboard-reachable close button that closes the sheet', () => {
    const { getByTestId, getByLabelText, queryByTestId } = render(
      <WhichKeyProvider><Setup /><ShortcutCheatsheet /></WhichKeyProvider>,
    );
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })); });
    const close = getByLabelText('Close keyboard shortcuts');
    expect(getByTestId('whichkey-cheatsheet').contains(close)).toBe(true);
    act(() => { close.click(); });
    expect(queryByTestId('whichkey-cheatsheet')).toBeNull();
  });
});
```

If the existing file has no `Setup` helper, define one at the top of the new describe block:
```tsx
const Setup = () => { useShortcut('q', () => {}, { description: 'Quit' }); return null; };
```
and add `useShortcut` plus `act` to the file's imports.

- [ ] **Step 2: Write the failing vanilla test**

Append to `src/vanilla/__tests__/mount.test.ts`:

```ts
it('gives the cheatsheet panel modal semantics, focus, and a close button', () => {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  trigger.focus();

  const wk = createWhichKey();
  wk.register('q', vi.fn(), { description: 'Quit' });
  const ui = mountWhichKey(wk);
  wk.start();
  press('?');

  const panel = document.querySelector('.wk-cheatsheet') as HTMLElement;
  expect(panel.getAttribute('aria-modal')).toBe('true');
  expect(panel.getAttribute('aria-labelledby')).toBe('wk-cheatsheet-title');
  expect(panel.contains(document.activeElement)).toBe(true);

  const close = panel.querySelector('.wk-cheatsheet__close') as HTMLButtonElement;
  expect(close).not.toBeNull();
  close.click();
  expect(wk.getSnapshot().cheatsheet.visible).toBe(false);
  expect(document.activeElement).toBe(trigger);

  ui.unmount();
  wk.stop();
  trigger.remove();
});
```

- [ ] **Step 3: Run both to confirm RED**

```bash
npx vitest run src/react/__tests__/ShortcutCheatsheet.test.tsx src/vanilla/__tests__/mount.test.ts
```
Expected: the new tests FAIL on the missing `aria-modal` attribute.

- [ ] **Step 4: Commit the RED tests**

```bash
git add src/react/__tests__/ShortcutCheatsheet.test.tsx src/vanilla/__tests__/mount.test.ts
git commit -m "test: characterize cheatsheet focus management before fix [B3]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

- [ ] **Step 5: Declare the shared constants in each renderer**

Both renderers need the same two values. Keep a separate copy in each file rather than a shared module — `src/vanilla/` must not import from `src/react/`, and neither may pull React into the engine.

Add to the top of **`src/react/ShortcutCheatsheet.tsx`** (module-local, not exported):

```ts
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CHEATSHEET_TITLE_ID = 'wk-cheatsheet-title';
```

Add the identical pair to the top of **`src/vanilla/cheatsheet.ts`** (also module-local):

```ts
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CHEATSHEET_TITLE_ID = 'wk-cheatsheet-title';
```

The literal `'wk-cheatsheet-title'` is asserted by the tests in Steps 1-2 and must match exactly in both files.

- [ ] **Step 6: Rewrite the React component**

Replace the body of `src/react/ShortcutCheatsheet.tsx` from the `useEffect` through the returned JSX:

```tsx
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!engine || !visible) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { engine.closeCheatsheet(); return; }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [engine, visible]);
```

Add `useRef` to the React import. Then update the panel element and title, and insert the close button as the panel's first child:

```tsx
      <div ref={panelRef} data-testid="whichkey-cheatsheet" className="wk-cheatsheet"
           onClick={(e) => e.stopPropagation()} tabIndex={-1}
           role="dialog" aria-modal="true" aria-labelledby={CHEATSHEET_TITLE_ID}>
        <button type="button" className="wk-cheatsheet__close"
                aria-label="Close keyboard shortcuts" onClick={engine.closeCheatsheet}>×</button>
        <h2 id={CHEATSHEET_TITLE_ID} className="wk-cheatsheet__title">Keyboard shortcuts</h2>
```

Leave the rest of the JSX unchanged.

- [ ] **Step 7: Rewrite the vanilla renderer**

In `src/vanilla/cheatsheet.ts`, change the signature and panel setup:

```ts
export const renderCheatsheet = (
  p: string, model: CheatsheetModel, onClose: () => void,
): { element: HTMLElement; destroy: () => void } => {
```

After `panel.setAttribute('aria-label', ...)` — replace that `aria-label` line with:

```ts
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', CHEATSHEET_TITLE_ID);
  panel.tabIndex = -1;
  panel.addEventListener('click', (e) => e.stopPropagation());

  const close = document.createElement('button');
  close.type = 'button';
  close.className = `${p}-cheatsheet__close`;
  close.setAttribute('aria-label', 'Close keyboard shortcuts');
  close.textContent = '×';
  close.addEventListener('click', onClose);
  panel.appendChild(close);
```

Give the title an id (`title.id = CHEATSHEET_TITLE_ID;` right after its `className` assignment).

At the end, replace `return backdrop;` with focus wiring and the new return shape:

```ts
  backdrop.appendChild(panel);

  // NB: focus is NOT moved here — the node is not in the document yet, so
  // panel.focus() would be a no-op. mount.ts focuses it after appendChild.
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault(); first.focus();
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    element: backdrop,
    destroy: () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    },
  };
};
```


- [ ] **Step 8: Wire mount.ts to the new shape**

In `src/vanilla/mount.ts`, add alongside `cheatsheetNode`:

```ts
  let cheatsheetDestroy: (() => void) | null = null;
```

Replace the open branch:

```ts
      if (snap.cheatsheet.visible && !cheatsheetNode) {
        const sheet = renderCheatsheet(prefix, engine.getCheatsheetModel(), () => engine.closeCheatsheet());
        cheatsheetNode = sheet.element;
        cheatsheetDestroy = sheet.destroy;
        container.appendChild(cheatsheetNode);
        (cheatsheetNode.querySelector(`.${prefix}-cheatsheet`) as HTMLElement | null)?.focus();
        document.addEventListener('keydown', onEscape);
      } else if (!snap.cheatsheet.visible && cheatsheetNode) {
        cheatsheetNode.remove();
        cheatsheetNode = null;
        cheatsheetDestroy?.();
        cheatsheetDestroy = null;
        document.removeEventListener('keydown', onEscape);
      }
```

And in `unmount()`, after `cheatsheetNode?.remove();` add `cheatsheetDestroy?.(); cheatsheetDestroy = null;`.

The `.focus()` call above is what actually moves focus into the panel — it runs after `appendChild`, so the element is in the document and focusable. This is why `cheatsheet.ts` deliberately does not call `focus()` itself.

- [ ] **Step 9: Style the close button**

Append to `src/styles.css`:

```css
.wk-cheatsheet__close {
  float: right; margin: -0.25rem -0.25rem 0 0;
  background: none; border: none; cursor: pointer;
  color: #9ca3af; font-size: 1.25rem; line-height: 1;
  padding: 0.25rem 0.5rem; border-radius: 0.25rem;
}
.wk-cheatsheet__close:hover { color: #f3f4f6; }
.wk-cheatsheet__close:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
.wk-cheatsheet:focus-visible { outline: 2px solid #93c5fd; outline-offset: -2px; }
```

- [ ] **Step 10: Verify GREEN and run the full gate**

```bash
npx vitest run src/react/__tests__/ShortcutCheatsheet.test.tsx src/vanilla/__tests__/mount.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 11: Strip B3 from bughunt.md and commit**

```bash
git add src/react/ShortcutCheatsheet.tsx src/vanilla/cheatsheet.ts src/vanilla/mount.ts src/styles.css bughunt.md
git commit -m "fix(frontend): trap and restore focus in the cheatsheet dialog [B3]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 4: B4 — consumer handler exceptions wedge the matcher

**Files:**
- Modify: `src/engine/matcher.ts:47-48` and `:62-64`
- Modify: `src/engine/controller.ts:117`
- Test: `src/engine/__tests__/controller.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `onFire` never propagates a consumer exception; `resetBuffer()` always runs. Tasks 8 and 9 edit adjacent lines in `handleKeyDown` — re-read the file before editing.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/controller.test.ts`:

```ts
describe('handler exceptions', () => {
  it('resets sequence state when an immediate leaf handler throws', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wk = createWhichKey();
    const ok = vi.fn();
    wk.register('x', () => { throw new Error('boom'); }, { description: 'Boom' });
    wk.register('y', ok, { description: 'Fine' });
    wk.start();

    expect(() => press('x')).not.toThrow();
    press('y');

    expect(ok).toHaveBeenCalledTimes(1);
    expect(wk.getSnapshot().popup.visible).toBe(false);
    expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
    expect(err).toHaveBeenCalled();
    expect(String(err.mock.calls[0][0])).toContain('[whichkey]');
    wk.stop();
    err.mockRestore();
  });

  it('resets sequence state when a deferred leaf-and-prefix handler throws', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wk = createWhichKey({ timeoutMs: 50 });
    const ok = vi.fn();
    wk.register('g', () => { throw new Error('boom'); }, { description: 'Leaf' });
    wk.register('g h', vi.fn(), { description: 'Deeper' });
    wk.register('y', ok, { description: 'Fine' });
    wk.start();

    press('g');
    expect(() => vi.advanceTimersByTime(60)).not.toThrow();
    press('y');

    expect(ok).toHaveBeenCalledTimes(1);
    expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
    expect(err).toHaveBeenCalled();
    wk.stop();
    err.mockRestore();
  });
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/controller.test.ts -t "handler exceptions"
```
Expected: FAIL — the throw escapes and the follow-up shortcut does not fire.

- [ ] **Step 3: Commit the RED tests**

```bash
git add src/engine/__tests__/controller.test.ts
git commit -m "test: characterize throwing handlers before fix [B4]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

- [ ] **Step 4: Guarantee reset in the matcher**

In `src/engine/matcher.ts`, pure-leaf branch:

```ts
      try {
        this.options.onFire(leaf, event);
      } finally {
        this.resetBuffer();
      }
      return;
```

Deferred branch inside the `setTimeout` callback:

```ts
        const synthetic = new KeyboardEvent('keydown', { key });
        try {
          this.options.onFire(leaf, synthetic);
        } finally {
          this.resetBuffer();
        }
```

(Leave the synthetic event itself alone — replacing it is B17, not in this batch.)

- [ ] **Step 5: Attribute the error in the controller**

In `src/engine/controller.ts`, replace the `onFire` option:

```ts
    onFire: (entry, event) => {
      try {
        entry.handler(event);
      } catch (err) {
        console.error(
          `[whichkey] Handler for "${entry.keys}" threw; sequence state was reset.`,
          err,
        );
      }
    },
```

- [ ] **Step 6: Verify GREEN and run the full gate**

```bash
npx vitest run src/engine/__tests__/controller.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 7: Strip B4 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts src/engine/controller.ts bughunt.md
git commit -m "fix(observability): contain handler exceptions and reset matcher state [B4]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 5: B5 — no-op snapshot emitted on every keystroke

**Files:**
- Modify: `src/engine/controller.ts:126-131` (the `onHidePopup` callback)
- Test: `src/engine/__tests__/controller.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `emit()` only fires on real state changes. Task 7 depends on this — it introduces an ARIA live region whose announcements would otherwise be triggered by every keypress.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/controller.test.ts`:

```ts
describe('snapshot emission', () => {
  it('does not notify subscribers for keystrokes that match nothing', () => {
    const wk = createWhichKey();
    wk.register('g h', vi.fn(), { description: 'Deep' });
    wk.start();
    const listener = vi.fn();
    wk.subscribe(listener);
    const before = wk.getSnapshot();

    press('a'); press('b'); press('c'); press('d'); press('e');

    expect(listener).not.toHaveBeenCalled();
    expect(wk.getSnapshot()).toBe(before);
    wk.stop();
  });

  it('still notifies exactly once when the popup actually opens', () => {
    const wk = createWhichKey({ timeoutMs: 50 });
    wk.register('g h', vi.fn(), { description: 'Deep' });
    wk.start();
    const listener = vi.fn();
    wk.subscribe(listener);

    press('g');
    vi.advanceTimersByTime(60);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(wk.getSnapshot().popup.visible).toBe(true);
    wk.stop();
  });
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/controller.test.ts -t "snapshot emission"
```
Expected: the first test FAILS — listener called 5 times, snapshot identity changed.

- [ ] **Step 3: Guard the callback**

In `src/engine/controller.ts`, replace the `onHidePopup` option:

```ts
    onHidePopup: () => {
      if (!popupVisible && currentSequence.length === 0) return;
      popupVisible = false;
      currentSequence = [];
      emit();
    },
```

- [ ] **Step 4: Verify GREEN and run the full gate**

```bash
npx vitest run src/engine/__tests__/controller.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```
If any existing test counted emissions and now sees fewer, that test was asserting the bug — re-read it, and only then decide. Do not weaken an assertion to make it pass without understanding why it changed.

- [ ] **Step 5: Strip B5 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts bughunt.md
git commit -m "fix(caching): skip no-op snapshot emissions on unmatched keystrokes [B5]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

> **MILESTONE:** run the full suite now. `npm test` must be green with ≥200 tests before starting Task 6.

---

### Task 6: B6 — full candidate list built per keystroke just to test emptiness

**Files:**
- Modify: `src/engine/registry.ts` (add `hasCandidates`)
- Modify: `src/engine/matcher.ts:38, 40, 52, 69`
- Test: `src/engine/__tests__/registry.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `ShortcutRegistry.hasCandidates(prefix: string): boolean` — Task 9 does not need it, but Tasks 8 and 9 edit the same `handleKeyDown` lines, so re-read the file.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/registry.test.ts`:

```ts
describe('hasCandidates', () => {
  const build = () => new ShortcutRegistry();

  it('agrees with getActiveCandidates across leaf, group, mixed and empty prefixes', () => {
    const r = build();
    r.register(entry({ id: '1', keys: 'g a' }));
    r.register(entry({ id: '2', keys: 'g b c' }));
    r.register(entry({ id: '3', keys: 'z' }));
    for (const prefix of ['g', 'g b', 'z', 'nope', '']) {
      expect(r.hasCandidates(prefix)).toBe(r.getActiveCandidates(prefix).length > 0);
    }
  });

  it('returns false when the only matching entry is disabled', () => {
    const r = build();
    r.register(entry({ id: '1', keys: 'g a', enabled: false }));
    expect(r.hasCandidates('g')).toBe(false);
    expect(r.getActiveCandidates('g').length).toBe(0);
  });

  it('returns false when the only matching entry is blocked by an exclusive layer', () => {
    const r = build();
    r.register(entry({ id: '1', keys: 'g a', level: 0 }));
    r.activateLayer('L', 1, true);
    expect(r.hasCandidates('g')).toBe(false);
    expect(r.getActiveCandidates('g').length).toBe(0);
  });
});
```

Reuse the file's existing `entry(...)` factory; if it is not already defined there, copy the one from `src/engine/__tests__/matcher.test.ts`.

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/registry.test.ts -t "hasCandidates"
```
Expected: FAIL — `r.hasCandidates is not a function`.

- [ ] **Step 3: Add the method**

In `src/engine/registry.ts`, add right after `getActiveCandidates`:

```ts
  /**
   * Cheap existence check for `getActiveCandidates(prefix).length > 0`.
   * Runs on every keystroke, so it allocates nothing and exits on the first hit.
   */
  hasCandidates(prefix: string): boolean {
    const prefixWithSpace = prefix + ' ';
    for (const [keys, bucket] of this.shortcuts) {
      if (!keys.startsWith(prefixWithSpace)) continue;
      if (this.findActive(bucket) !== undefined) return true;
    }
    return false;
  }
```

- [ ] **Step 4: Use it in the matcher**

In `src/engine/matcher.ts`, replace the candidate lookup and its three consumers:

```ts
    const leaf = this.registry.getActive(prospectiveKeys);
    const hasCandidates = this.registry.hasCandidates(prospectiveKeys);

    if (leaf && !hasCandidates) {
```
```ts
    if (leaf && hasCandidates) {
```
```ts
    if (!leaf && hasCandidates) {
```

- [ ] **Step 5: Verify GREEN and run the full gate**

```bash
npx vitest run src/engine/__tests__/registry.test.ts src/engine/__tests__/matcher.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```
Behaviour must be identical — this is a pure optimization. Any behavioural test that changes is a bug in the change.

- [ ] **Step 6: Strip B6 from bughunt.md and commit**

```bash
git add src/engine/registry.ts src/engine/matcher.ts src/engine/__tests__/registry.test.ts bughunt.md
git commit -m "fix(caching): add allocation-free hasCandidates for the keystroke hot path [B6]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 7: B7 — popup `role="dialog"` is silent to screen readers

**Files:**
- Modify: `src/react/WhichKeyPopup.tsx:34, 44`
- Modify: `src/vanilla/popup.ts:46-47`
- Test: `src/react/__tests__/WhichKeyPopup.test.tsx` (append), `src/vanilla/__tests__/mount.test.ts` (append)

**Interfaces:**
- Consumes: Task 5's emission guard (so the live region only announces on real changes).
- Produces: nothing downstream.

No existing test asserts `role` or `aria-*` on the popup (verified by grep), so no existing test needs editing.

- [ ] **Step 1: Write the failing tests**

Append to `src/react/__tests__/WhichKeyPopup.test.tsx`:

```tsx
it('announces as a polite live region, not a dialog', () => {
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
```

Wrap with `vi.useFakeTimers()` in a `beforeEach` if the file does not already do so.

Append to `src/vanilla/__tests__/mount.test.ts`:

```ts
it('renders the popup as a polite live region in the vanilla renderer', () => {
  const wk = createWhichKey();
  wk.registerGroup('g', { description: 'Go' });
  wk.register('g a', vi.fn(), { description: 'Alpha' });
  const ui = mountWhichKey(wk);
  wk.start();
  press('g');
  vi.advanceTimersByTime(500);
  const popup = document.querySelector('.wk-popup') as HTMLElement;
  expect(popup.getAttribute('role')).toBe('status');
  expect(popup.getAttribute('aria-live')).toBe('polite');
  expect(popup.getAttribute('aria-atomic')).toBe('true');
  ui.unmount();
  wk.stop();
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts
```
Expected: FAIL — role is `dialog`.

- [ ] **Step 3: Change the React popup**

In `src/react/WhichKeyPopup.tsx`, in **both** `VerticalCorner` and `HorizontalBar`, replace:

```tsx
       role="dialog" aria-label="Keyboard shortcuts">
```
with:
```tsx
       role="status" aria-live="polite" aria-atomic="true" aria-label="Keyboard shortcuts">
```

- [ ] **Step 4: Change the vanilla popup**

In `src/vanilla/popup.ts`, replace:

```ts
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Keyboard shortcuts');
```
with:
```ts
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('aria-label', 'Keyboard shortcuts');
```

- [ ] **Step 5: Verify GREEN and run the full gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 6: Strip B7 from bughunt.md and commit**

```bash
git add src/react/WhichKeyPopup.tsx src/vanilla/popup.ts src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts bughunt.md
git commit -m "fix(frontend): announce the leader popup as a polite live region [B7]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 8: B10 — shadow-DOM input-guard bypass

**Files:**
- Modify: `src/engine/matcher.ts` (top of `handleKeyDown`, plus lines 43 and 56)
- Test: `src/engine/__tests__/matcher.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `const eventTarget` inside `handleKeyDown`, the un-retargeted event origin. **Task 9 consumes this** — it must call `isInputTarget(eventTarget)`, not `isInputTarget(event.target)`.
- **Do not change the exported `isInputTarget` signature** — it is public API (`src/engine/index.ts:2`).

- [ ] **Step 1: Write the failing test**

Append to `src/engine/__tests__/matcher.test.ts`:

```ts
describe('shadow DOM input guard', () => {
  it('suppresses a shortcut typed into an input inside an open shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'password';
    root.appendChild(input);

    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'd', enableOnInputs: false }));

    const event = new KeyboardEvent('keydown', { key: 'd', composed: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: host });
    Object.defineProperty(event, 'composedPath', { value: () => [input, root, host, document] });
    matcher.handleKeyDown(event);

    expect(onFire).not.toHaveBeenCalled();
    host.remove();
  });

  it('is unchanged for ordinary light-DOM targets', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire });
    registry.register(entry({ keys: 'd', enableOnInputs: false }));

    const div = document.createElement('div');
    document.body.appendChild(div);
    const event = new KeyboardEvent('keydown', { key: 'd' });
    Object.defineProperty(event, 'target', { value: div });
    matcher.handleKeyDown(event);

    expect(onFire).toHaveBeenCalledTimes(1);
    div.remove();
  });
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/matcher.test.ts -t "shadow DOM"
```
Expected: the first test FAILS — the handler fires because the guard sees the host `<div>`.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/engine/__tests__/matcher.test.ts
git commit -m "test: characterize shadow-DOM input guard before fix [B10]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

- [ ] **Step 4: Resolve the composed target**

In `src/engine/matcher.ts`, at the very top of `handleKeyDown` (after the `isModifierOnlyEvent` early return):

```ts
    // An event crossing an open shadow boundary is retargeted to the host, so
    // `event.target` would hide the real <input>. composedPath()[0] is the
    // un-retargeted origin, and equals event.target outside shadow DOM.
    const eventTarget = typeof event.composedPath === 'function'
      ? (event.composedPath()[0] ?? event.target)
      : event.target;
```

- [ ] **Step 5: Use it at both guard sites**

Replace `isInputTarget(event.target)` on the pure-leaf path with `isInputTarget(eventTarget)`, and replace `const fireTarget = event.target;` with `const fireTarget = eventTarget;`.

- [ ] **Step 6: Verify GREEN and run the full gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 7: Strip B10 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts bughunt.md
git commit -m "fix(security): resolve the composed event target so shadow-DOM inputs are guarded [B10]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 9: B9 — popup renders keystrokes typed into inputs

**Files:**
- Modify: `src/engine/matcher.ts` (prefix-only branch, lines ~69-83)
- Test: `src/engine/__tests__/controller.test.ts` (append)

**Interfaces:**
- Consumes: `eventTarget` from Task 8. Use it, not `event.target`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/controller.test.ts`:

```ts
describe('popup suppression in text fields', () => {
  it('does not show the popup for a leader key typed into a password field', () => {
    const input = document.createElement('input');
    input.type = 'password';
    document.body.appendChild(input);

    const wk = createWhichKey({ timeoutMs: 50 });
    wk.register('g h', vi.fn(), { description: 'Deep', enableOnInputs: false });
    wk.start();

    press('g', input);
    vi.advanceTimersByTime(60);

    expect(wk.getSnapshot().popup.visible).toBe(false);
    expect(wk.getSnapshot().popup.currentSequence).toEqual([]);
    wk.stop();
    input.remove();
  });

  it('still shows the popup for the same key outside a text field', () => {
    const wk = createWhichKey({ timeoutMs: 50 });
    wk.register('g h', vi.fn(), { description: 'Deep' });
    wk.start();

    press('g');
    vi.advanceTimersByTime(60);

    expect(wk.getSnapshot().popup.visible).toBe(true);
    wk.stop();
  });

  it('still completes a deeper sequence whose leaf opted in with enableOnInputs', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const fn = vi.fn();

    const wk = createWhichKey({ timeoutMs: 50 });
    wk.register('g h', fn, { description: 'Deep', enableOnInputs: true });
    wk.start();

    press('g', input);
    press('h', input);

    expect(fn).toHaveBeenCalledTimes(1);
    wk.stop();
    input.remove();
  });
});
```

The file's `press` helper already accepts a target as its second argument.

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/controller.test.ts -t "popup suppression"
```
Expected: the first test FAILS — the popup becomes visible with `["g"]`.

- [ ] **Step 3: Commit the RED tests**

```bash
git add src/engine/__tests__/controller.test.ts
git commit -m "test: characterize popup suppression in text fields before fix [B9]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

- [ ] **Step 4: Gate popup display on the input guard**

In `src/engine/matcher.ts`, in the prefix-only branch, wrap **only** the display logic. `commitBuffer` must stay outside the guard so a deeper `enableOnInputs: true` leaf can still complete:

```ts
    if (!leaf && hasCandidates) {
      // Prefix-only — commit buffer, start timer to show popup.
      this.commitBuffer(prospective);
      this.clearTimer();
      // Never surface buffered keystrokes that were typed into a text field:
      // the characters themselves would be rendered on screen.
      if (isInputTarget(eventTarget)) return;
      if (this.popupVisible) {
        this.options.onShowPopup({ currentSequence: [...this.buffer] });
      } else {
        this.timer = setTimeout(() => {
          this.popupVisible = true;
          this.options.onShowPopup({ currentSequence: [...this.buffer] });
        }, this.options.timeoutMs);
      }
      return;
    }
```

- [ ] **Step 5: Verify GREEN and run the full gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 6: Strip B9 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts bughunt.md
git commit -m "fix(security): never render buffered keystrokes typed into text fields [B9]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 10: B8 — duplicate-registration warning cries wolf

**Files:**
- Modify: `src/engine/registry.ts:34-47` (the `register` method)
- Modify: `src/engine/__tests__/registry.test.ts:77-85` — **the one sanctioned existing-test edit in this plan**, because those assertions pin the exact warning text being corrected.
- Test: `src/engine/__tests__/registry.test.ts` (also append new cases)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing downstream.

- [ ] **Step 1: Write the new tests**

Append to `src/engine/__tests__/registry.test.ts`:

```ts
describe('collision warning precision', () => {
  it('stays silent when an exclusive layer makes the existing entry unreachable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'Escape', level: 0, description: 'page escape' }));
    r.activateLayer('L', 1, true);
    r.register(entry({ id: '2', keys: 'Escape', level: 1, description: 'Close' }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays silent when the only existing entry is disabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'x', enabled: false }));
    r.register(entry({ id: '2', keys: 'x' }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and names the real winner on a same-level collision', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = new ShortcutRegistry();
    r.register(entry({ id: '1', keys: 'x', priority: 5, description: 'Winner' }));
    r.register(entry({ id: '2', keys: 'x', priority: 0, description: 'Loser' }));
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain('"x"');
    expect(msg).toContain('Winner');
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Update the existing pinned assertions**

In `src/engine/__tests__/registry.test.ts:77-85`, the test asserts the substring `Shortcut "g n" registered while another is active` and the existing description. Change **only** the expected message text to match the new wording — keep the scenario and the "warns once" assertion as they are. The neighbouring test at :87-90 (no warn on first registration) must pass unchanged; do not touch it.

- [ ] **Step 3: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/registry.test.ts
```
Expected: the three new tests FAIL (warnings fire where they should not), and the edited assertion FAILS pending the implementation.

- [ ] **Step 4: Rewrite the warning**

In `src/engine/registry.ts`, replace the whole warn block at the top of `register` and move it after the insert:

```ts
  register(entry: ShortcutEntry): void {
    const bucket = this.shortcuts.get(entry.keys) ?? [];
    const insertIndex = bucket.findIndex((e) => e.priority > entry.priority);
    bucket.splice(insertIndex === -1 ? bucket.length : insertIndex, 0, entry);
    this.shortcuts.set(entry.keys, bucket);

    // Only a genuine same-level collision is worth warning about. A different
    // level is the documented layer-override mechanism, and an unreachable or
    // disabled incumbent is not a competitor at all.
    const winner = this.findActive(bucket);
    if (winner !== undefined && winner.id !== entry.id && winner.level === entry.level) {
      console.warn(
        `[whichkey] Shortcut "${entry.keys}" is shadowed: "${winner.description ?? '(no description)'}" ` +
          `(level ${winner.level}, priority ${winner.priority}) wins over the registration just made ` +
          `(level ${entry.level}, priority ${entry.priority}). Raise its priority or unregister one.`,
      );
    }
  }
```

- [ ] **Step 5: Verify GREEN and run the full gate**

```bash
npx vitest run src/engine/__tests__/registry.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 6: Strip B8 from bughunt.md and commit**

```bash
git add src/engine/registry.ts src/engine/__tests__/registry.test.ts bughunt.md
git commit -m "fix(observability): warn only on genuine same-level shortcut collisions [B8]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

> **MILESTONE:** run the full suite now. `npm test` must be green before starting Task 11.

---

### Task 11: B11 — lowercase modifiers rejected despite docs

**Files:**
- Modify: `src/engine/keys.ts:65` (`KNOWN_MODIFIERS`), `:73` (bare-modifier check), `:78-102` (the modifier loop)
- Test: `src/engine/__tests__/keys.test.ts` (append)

**Interfaces:**
- Consumes: nothing. Task 2 also edited `parseKey`, in the base-character region — re-read the file before editing.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing tests**

Append to `src/engine/__tests__/keys.test.ts`:

```ts
describe('modifier case-insensitivity', () => {
  it('accepts every documented modifier in any case', () => {
    expect(parseKey('ctrl+s')).toBe('Ctrl+s');
    expect(parseKey('CTRL+s')).toBe('Ctrl+s');
    expect(parseKey('Ctrl+s')).toBe('Ctrl+s');
    expect(parseKey('alt+x')).toBe('Alt+x');
    expect(parseKey('shift+Tab')).toBe('Shift+Tab');
    expect(parseKey('cmd+k')).toBe('Cmd+k');
  });

  it('accepts the common spelled-out aliases', () => {
    expect(parseKey('control+s')).toBe('Ctrl+s');
    expect(parseKey('option+x')).toBe('Alt+x');
    expect(parseKey('meta+k')).toBe('Cmd+k');
    expect(parseKey('command+k')).toBe('Cmd+k');
  });

  it('round-trips a lowercase modifier against a real keypress', () => {
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    expect(parseKey('ctrl+s')).toBe(eventToCanonical(event));
  });

  it('still rejects a genuinely unknown modifier', () => {
    expect(() => parseKey('Hyper+K')).toThrow(/unknown modifier/);
    expect(() => parseKey('hyper+K')).toThrow(/unknown modifier/);
  });

  it('still rejects a bare modifier with no key', () => {
    expect(() => parseKey('ctrl+')).toThrow();
    expect(() => parseKey('ctrl')).toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/engine/__tests__/keys.test.ts -t "modifier case-insensitivity"
```
Expected: FAIL — `whichkey: unknown modifier "ctrl"`.

- [ ] **Step 3: Add the alias table**

In `src/engine/keys.ts`, replace the `KNOWN_MODIFIERS` constant:

```ts
const MODIFIER_ALIASES = new Map<string, string>([
  ['ctrl', 'Ctrl'], ['control', 'Ctrl'],
  ['alt', 'Alt'], ['option', 'Alt'],
  ['shift', 'Shift'],
  ['cmd', 'Cmd'], ['meta', 'Cmd'], ['command', 'Cmd'],
  ['mod', 'Mod'],
]);
```

- [ ] **Step 4: Normalize in parseKey**

Replace the bare-modifier guard:

```ts
  if (baseRaw === '' || MODIFIER_ALIASES.has(baseRaw.toLowerCase())) {
    throw new Error(`whichkey: missing key after modifier(s) in "${input}"`);
  }
```

And the loop head:

```ts
  for (const seg of segments) {
    const mod = MODIFIER_ALIASES.get(seg.toLowerCase());
    if (mod === undefined) {
      throw new Error(`whichkey: unknown modifier "${seg}" in "${input}"`);
    }
    switch (mod) {
```

Leave the switch arms themselves unchanged.

- [ ] **Step 5: Verify GREEN and run the full gate**

```bash
npx vitest run src/engine/__tests__/keys.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 6: Strip B11 from bughunt.md and commit**

```bash
git add src/engine/keys.ts src/engine/__tests__/keys.test.ts bughunt.md
git commit -m "fix(correctness): accept modifier names case-insensitively as documented [B11]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 12: B12 — `exports` never points at the emitted `.d.cts`

**Files:**
- Modify: `package.json:32-48` (the `exports` block)
- Create: `src/engine/__tests__/package-exports.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

Create `src/engine/__tests__/package-exports.test.ts`. The dist-existence half is skipped when `dist/` is absent, because CI runs `npm test` **before** `npm run build`.

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pkg = JSON.parse(readFileSync(root + 'package.json', 'utf8')) as {
  exports: Record<string, unknown>;
};
const SUBPATHS = ['.', './react', './vanilla'] as const;

describe('package exports', () => {
  it('declares nested per-format conditions with types first', () => {
    for (const sub of SUBPATHS) {
      const entry = pkg.exports[sub] as Record<string, Record<string, string>>;
      expect(Object.keys(entry)).toEqual(['import', 'require']);
      expect(Object.keys(entry.import)).toEqual(['types', 'default']);
      expect(Object.keys(entry.require)).toEqual(['types', 'default']);
      expect(entry.import.types).toMatch(/\.d\.ts$/);
      expect(entry.import.default).toMatch(/\.js$/);
      expect(entry.require.types).toMatch(/\.d\.cts$/);
      expect(entry.require.default).toMatch(/\.cjs$/);
    }
  });

  it('still exports the stylesheet', () => {
    expect(pkg.exports['./styles.css']).toBe('./dist/styles.css');
  });

  it.skipIf(!existsSync(root + 'dist'))('points every condition at a file that exists', () => {
    const targets: string[] = [];
    for (const sub of SUBPATHS) {
      const entry = pkg.exports[sub] as Record<string, Record<string, string>>;
      targets.push(entry.import.types, entry.import.default, entry.require.types, entry.require.default);
    }
    targets.push(pkg.exports['./styles.css'] as string);
    for (const t of targets) {
      expect({ target: t, exists: existsSync(root + t.replace(/^\.\//, '')) })
        .toEqual({ target: t, exists: true });
    }
  });
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npm run build && npx vitest run src/engine/__tests__/package-exports.test.ts
```
Expected: FAIL — the shape test sees the flat `{ types, import, require }` object.

- [ ] **Step 3: Nest the export conditions**

In `package.json`, replace the three code subpaths (leave `./styles.css` as-is):

```json
    ".": {
      "import": { "types": "./dist/engine/index.d.ts", "default": "./dist/engine/index.js" },
      "require": { "types": "./dist/engine/index.d.cts", "default": "./dist/engine/index.cjs" }
    },
    "./react": {
      "import": { "types": "./dist/react/index.d.ts", "default": "./dist/react/index.js" },
      "require": { "types": "./dist/react/index.d.cts", "default": "./dist/react/index.cjs" }
    },
    "./vanilla": {
      "import": { "types": "./dist/vanilla/index.d.ts", "default": "./dist/vanilla/index.js" },
      "require": { "types": "./dist/vanilla/index.d.cts", "default": "./dist/vanilla/index.cjs" }
    },
```

- [ ] **Step 4: Verify GREEN and confirm the tarball**

```bash
npm run build
npx vitest run src/engine/__tests__/package-exports.test.ts
npm pack --dry-run
npm run lint && npm run typecheck && npm test
```
Expected: all export targets exist; `npm pack --dry-run` still lists LICENSE, README.md, package.json and `dist/**`.

- [ ] **Step 5: Strip B12 from bughunt.md and commit**

```bash
git add package.json src/engine/__tests__/package-exports.test.ts bughunt.md
git commit -m "fix(api-surface): point require conditions at the emitted .d.cts declarations [B12]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

### Task 13: B13 — CSS class contract table is wrong and incomplete

**Files:**
- Create: `src/__tests__/class-contract.test.tsx`
- Modify: `README.md:226-241` (class table), `docs/API.md:370-384` (class table)

**Interfaces:**
- Consumes: `wk-cheatsheet__close` from Task 3.
- Produces: nothing downstream.

The finding carried `risk: high` because nothing tests the contract, but a documentation edit cannot regress runtime behaviour — so no characterization commit is needed. The drift-guard test below is the load-bearing part: without it the tables drift again, which is exactly how they got wrong.

- [ ] **Step 1: Write the drift-guard test**

Create `src/__tests__/class-contract.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWhichKey } from '../engine';
import { mountWhichKey } from '../vanilla';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** The documented CSS class contract. Adding a class to a renderer means adding it here AND to both doc tables. */
const CONTRACT = [
  'wk-kbd',
  'wk-popup', 'wk-popup--vertical', 'wk-popup--horizontal',
  'wk-popup__header', 'wk-popup__body', 'wk-popup__list', 'wk-popup__grid',
  'wk-row', 'wk-row--group', 'wk-row__label',
  'wk-sequence', 'wk-sequence__ellipsis',
  'wk-backdrop', 'wk-cheatsheet', 'wk-cheatsheet__close', 'wk-cheatsheet__title',
  'wk-cheatsheet__sections', 'wk-cheatsheet__section',
  'wk-cheatsheet__list', 'wk-cheatsheet__list--nested', 'wk-cheatsheet__item',
  'wk-cheatsheet__group-title', 'wk-cheatsheet__group-label', 'wk-cheatsheet__hint',
] as const;

const collectClasses = (): Set<string> => {
  const found = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>('*')) {
    for (const c of el.classList) found.add(c);
  }
  return found;
};

const renderEverything = (layout: 'vertical' | 'horizontal') => {
  const wk = createWhichKey({ timeoutMs: 10 });
  wk.registerGroup('g', { description: 'Go to' });
  wk.register('g a', vi.fn(), { description: 'Alpha' });
  wk.register('g b c', vi.fn(), { description: 'Deep' });
  wk.register('q', vi.fn(), { description: 'Quit' });
  const ui = mountWhichKey(wk, { popup: { layout } });
  wk.start();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
  vi.advanceTimersByTime(20);
  wk.openCheatsheet();
  return { wk, ui };
};

describe('CSS class contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('emits exactly the documented class set across both popup layouts', () => {
    const emitted = new Set<string>();
    for (const layout of ['vertical', 'horizontal'] as const) {
      const { wk, ui } = renderEverything(layout);
      for (const c of collectClasses()) emitted.add(c);
      ui.unmount(); wk.stop(); document.body.innerHTML = '';
    }
    expect([...emitted].sort()).toEqual([...CONTRACT].sort());
  });

  it('documents every emitted class in README.md and docs/API.md', () => {
    const readme = readFileSync(root + 'README.md', 'utf8');
    const api = readFileSync(root + 'docs/API.md', 'utf8');
    const missingReadme = CONTRACT.filter((c) => !readme.includes(`\`${c}\``));
    const missingApi = CONTRACT.filter((c) => !api.includes(`\`${c}\``));
    expect({ missingReadme, missingApi }).toEqual({ missingReadme: [], missingApi: [] });
  });
});
```

- [ ] **Step 2: Run to confirm RED**

```bash
npx vitest run src/__tests__/class-contract.test.tsx
```
Expected: the docs test FAILS listing ~11 classes missing from both tables. If the first test also fails, reconcile `CONTRACT` with what the renderers actually emit — the renderers are the source of truth, not the list.

- [ ] **Step 3: Fix the README table**

In `README.md`, replace the `wk-cheatsheet` row with the corrected and expanded set:

```markdown
| `wk-backdrop`               | Full-screen dimmed overlay behind the cheatsheet |
| `wk-cheatsheet`             | Cheatsheet panel (scrollable content box)     |
| `wk-cheatsheet__close`      | Close button in the cheatsheet panel          |
| `wk-cheatsheet__title`      | Cheatsheet heading                            |
| `wk-cheatsheet__sections`   | Wrapper around all cheatsheet sections        |
| `wk-cheatsheet__section`    | One group's section                           |
| `wk-cheatsheet__list`       | List of shortcut entries                      |
| `wk-cheatsheet__list--nested` | Modifier: list nested under a group         |
| `wk-cheatsheet__item`       | One shortcut entry                            |
| `wk-cheatsheet__group-title` | Group heading row                            |
| `wk-cheatsheet__group-label` | Group description text                       |
| `wk-cheatsheet__hint`       | "Press Escape to close" footer                |
```

- [ ] **Step 4: Fix the docs/API.md table**

Apply the same replacement to the `wk-cheatsheet` row of the class table in `docs/API.md`, matching that table's column widths.

- [ ] **Step 5: Verify GREEN and run the full gate**

```bash
npx vitest run src/__tests__/class-contract.test.tsx
npm run lint && npm run typecheck && npm test && npm run build
```

- [ ] **Step 6: Strip B13 from bughunt.md and commit**

```bash
git add src/__tests__/class-contract.test.tsx README.md docs/API.md bughunt.md
git commit -m "fix(frontend): correct and complete the documented CSS class contract [B13]

Claude-Session: https://claude.ai/code/session_01EVQQ7m3xXEY4CMJqo1BKHC"
```

---

## Definition of done

- [ ] 13 fix commits plus 5 `test:` characterization commits (B1, B3, B4, B9, B10), each fix commit stripping its finding from `bughunt.md`.
- [ ] `bughunt.md` contains exactly B14–B43 and the 7 `decision-needed` markers — no B1–B13 blocks remain.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` all green.
- [ ] Test count strictly greater than the 192 baseline (expect ~215+).
- [ ] `git log --oneline` shows one commit per finding, none bundled.
