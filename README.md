# which-key

[![codecov](https://codecov.io/gh/stevenwcarter/which-key/branch/main/graph/badge.svg)](https://codecov.io/gh/stevenwcarter/which-key)

A framework-agnostic keyboard-shortcut engine with a leader-key popup and full-screen cheatsheet. Inspired by Emacs/Neovim `which-key`. Includes a React binding and a vanilla-DOM renderer — pick what fits your stack.

## Install

```bash
npm i which-key
```

React peer dependency (already installed in most React projects):

```bash
npm i react react-dom
```

---

## Quick start

### React

> **SSR / client-only:** `<WhichKeyPopup>` and `<ShortcutCheatsheet>` render nothing during server rendering (Next.js, Remix, etc.) and activate after hydration on the client — they are client-only UI components.

```tsx
import {
  WhichKeyProvider,
  useShortcut,
  useShortcutGroup,
  WhichKeyPopup,
  ShortcutCheatsheet,
} from 'which-key/react';
import 'which-key/styles.css';

function Editor() {
  useShortcutGroup('g', { description: 'Go to' });
  useShortcut('g h', () => location.assign('/'), { description: 'Home' });
  useShortcut('s', () => save(), { description: 'Save' });
  return <textarea />;
}

export default function App() {
  return (
    <WhichKeyProvider sortKeys="alphabetical">
      <Editor />
      <WhichKeyPopup layout="horizontal" />
      <ShortcutCheatsheet />
    </WhichKeyProvider>
  );
}
```

### Vanilla (no framework)

```ts
import { createWhichKey } from 'which-key';
import { mountWhichKey } from 'which-key/vanilla';
import 'which-key/styles.css';

const wk = createWhichKey({ sortKeys: 'alphabetical' });
wk.registerGroup('g', { description: 'Go to' });
wk.register('g h', () => location.assign('/'), { description: 'Home' });
wk.register('s', () => save(), { description: 'Save' });

mountWhichKey(wk, { popup: { layout: 'horizontal' } });
wk.start(); // attach the keydown listener; call wk.stop() to tear down
```

> **Note:** `mountWhichKey` subscribes the DOM renderer to the engine but does **not** call `engine.start()`. You must call `wk.start()` yourself so you control when the listener attaches. Call `wk.stop()` (or `unmount()`) to tear down.

---

## Concepts

### Key sequences

Shortcuts are strings of one or more space-separated keys:

| String   | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| `s`      | Single key `s`                                          |
| `g h`    | Leader sequence: press `g`, then `h`                    |
| `Ctrl+s` | `Control` + `s`                                         |
| `Alt+x`  | `Alt` (or `Option` on macOS) + `x`                      |
| `?`      | The shifted character itself — write `?`, not `Shift+/` |
| `Cmd+k`  | `Command` (macOS) + `k`                                 |
| `Mod+s`  | `Cmd` on macOS, `Ctrl` elsewhere                        |

Modifiers are case-insensitive and can be combined: `Ctrl+Shift+p`.

### Groups

A group labels the first key of a sequence so the popup can display a description instead of a bare key. Register a group before (or alongside) any shortcuts under that prefix:

```ts
wk.registerGroup('g', { description: 'Go to' });
wk.register('g h', () => navigate('/'), { description: 'Home' });
wk.register('g p', () => navigate('/profile'), { description: 'Profile' });
```

When the user presses `g`, the popup shows `Go to` next to the `g` row.

### The `?` cheatsheet

By default, pressing `?` opens a full-screen cheatsheet listing every registered shortcut. Disable it by passing `helpKey: null`:

```ts
createWhichKey({ helpKey: null });
```

Or change the key:

```ts
createWhichKey({ helpKey: 'F1' });
```

In React the same option lives on `<WhichKeyProvider helpKey="F1" />`.

### Sort modes

| Value             | Behavior                                         |
| ----------------- | ------------------------------------------------ |
| `'registration'`  | (default) Shortcuts appear in registration order |
| `'alphabetical'`  | Sorted A–Z by key string                         |
| custom comparator | `(a: string, b: string) => number`               |

---

### Layers

Layers scope a set of shortcuts to a UI state (e.g. a modal, a panel, a command palette). When you push a layer you get back a `LayerHandle` whose shortcuts are automatically cleaned up when the layer is popped.

**Engine / vanilla**

```ts
// Open a modal: push an exclusive layer so page shortcuts don't fire while it's open.
const layer = wk.pushLayer({ exclusive: true });

layer.register('Escape', () => closeModal(), { description: 'Close' });
layer.register('j', () => selectNext(), { description: 'Next item' });
layer.register('k', () => selectPrev(), { description: 'Previous item' });

// Close the modal: pop the layer — all its shortcuts are unregistered.
layer.pop();
```

`pushLayer` returns a `LayerHandle`:

| Property / method             | Description                                                     |
| ----------------------------- | --------------------------------------------------------------- |
| `level`                       | Numeric level assigned to this layer                            |
| `register(keys, fn, opts?)`   | Register a shortcut bound to this layer                         |
| `registerGroup(prefix, opts)` | Register a group label bound to this layer                      |
| `pop()`                       | Unregister all shortcuts on this layer and deactivate the layer |

**React**

Wrap the modal (or any conditional UI) in `<WhichKeyLayer>`. Every `useShortcut` and `useShortcutGroup` call inside it automatically binds to that layer. The layer activates on mount and deactivates on unmount — no manual cleanup needed.

```tsx
import {
  WhichKeyProvider,
  WhichKeyLayer,
  useShortcut,
  WhichKeyPopup,
  ShortcutCheatsheet,
} from 'which-key/react';
import { useState } from 'react';

function Modal({ onClose }: { onClose: () => void }) {
  // These shortcuts only fire while the modal is mounted.
  useShortcut('Escape', onClose, { description: 'Close' });
  useShortcut('j', () => console.log('next'), { description: 'Next item' });
  useShortcut('k', () => console.log('prev'), { description: 'Previous item' });
  return (
    <div role="dialog">
      <p>
        Modal open — press <kbd>j</kbd>/<kbd>k</kbd> to navigate, <kbd>Escape</kbd> to close.
      </p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <WhichKeyProvider>
      <button onClick={() => setOpen(true)}>Open modal</button>
      {open && (
        <WhichKeyLayer exclusive>
          <Modal onClose={() => setOpen(false)} />
        </WhichKeyLayer>
      )}
      <WhichKeyPopup />
      <ShortcutCheatsheet />
    </WhichKeyProvider>
  );
}
```

**Exclusive vs additive layers**

`pushLayer({ exclusive: true })` (or `<WhichKeyLayer exclusive>`) **blocks** all shortcuts registered at lower layers — the page shortcuts `s`, `g h`, etc. are silenced while the layer is active. `pushLayer({ exclusive: false })` (the default) **stacks additively**: lower-layer shortcuts continue to fire alongside the new layer's shortcuts. Multiple active layers are resolved in descending level order; the highest active exclusive layer forms a floor below which no lower shortcuts are reachable.

**Global shortcuts**

A shortcut registered with `global: true` pierces exclusive layers and fires regardless of which layer is active. The built-in `?` help shortcut is global by default — you can open the cheatsheet even when a modal layer is blocking everything else.

```ts
// Engine: register a global shortcut
wk.register('Mod+/', () => openHelp(), { description: 'Help', global: true });

// Inside a layer handle (vanilla)
layer.register('x', handler, { global: true });
```

```tsx
// React hook
useShortcut('Mod+/', () => openHelp(), { description: 'Help', global: true });
```

---

## Styling

Import the prebuilt stylesheet:

```ts
import 'which-key/styles.css';
```

Or bring your own by targeting the `wk-*` CSS class contract. The class _contract_ uses the `wk-` prefix, or whatever you pass as `classPrefix` to `mountWhichKey` (vanilla only) — but the _shipped stylesheet_ (`which-key/styles.css`) is always written against `wk-` regardless of `classPrefix`; see the warning below the custom-prefix example. Most of these carry the default theme's styling and can be overridden to customize appearance; a few (like `wk-popup-host`) are deliberately unstyled structural hooks the theme leaves alone:

| Class                         | Element                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `wk-popup`                    | Popup container                                                  |
| `wk-popup-host`               | Structural wrapper holding the popup; unstyled; **vanilla only** |
| `wk-popup--vertical`          | Modifier: corner popup layout                                    |
| `wk-popup--horizontal`        | Modifier: bottom-bar layout                                      |
| `wk-popup__header`            | Header area (vertical layout)                                    |
| `wk-popup__body`              | Body area (horizontal layout)                                    |
| `wk-popup__list`              | Candidate list (vertical layout)                                 |
| `wk-popup__grid`              | Candidate grid (horizontal layout)                               |
| `wk-row`                      | Single candidate row                                             |
| `wk-row--group`               | Modifier: row represents a group                                 |
| `wk-row__label`               | Candidate label text                                             |
| `wk-kbd`                      | `<kbd>` key chip                                                 |
| `wk-sequence`                 | Current-sequence display                                         |
| `wk-sequence__ellipsis`       | `…` trailing the current sequence                                |
| `wk-backdrop`                 | Full-screen dimmed overlay behind the cheatsheet                 |
| `wk-cheatsheet`               | Cheatsheet panel (scrollable content box)                        |
| `wk-cheatsheet__close`        | Close button in the cheatsheet panel                             |
| `wk-cheatsheet__title`        | Cheatsheet heading                                               |
| `wk-cheatsheet__sections`     | Wrapper around all cheatsheet sections                           |
| `wk-cheatsheet__section`      | One group's section                                              |
| `wk-cheatsheet__list`         | List of shortcut entries                                         |
| `wk-cheatsheet__list--nested` | Modifier: list nested under a group                              |
| `wk-cheatsheet__item`         | One shortcut entry                                               |
| `wk-cheatsheet__group-title`  | Group heading row                                                |
| `wk-cheatsheet__group-label`  | Group description text                                           |
| `wk-cheatsheet__hint`         | "Press Escape to close" footer                                   |

Custom `classPrefix` example (vanilla only):

```ts
mountWhichKey(wk, { classPrefix: 'myapp' });
// produces: myapp-popup, myapp-kbd, etc.
```

> **`classPrefix` opts you out of `which-key/styles.css` entirely.** The shipped stylesheet hardcodes `.wk-*` in every selector, so a custom prefix matches none of it — the popup and backdrop lose even their `position: fixed`, and everything renders inline in the body flow. This also swallows the entire `--wk-*` custom-property palette described below (including `--wk-z-index`/`--wk-z-index-backdrop`), since every one of them is only read inside the same `.wk-popup`/`.wk-backdrop`/etc. rules a custom prefix bypasses — none of them offer a partial override. In particular, the popup's background comes entirely from `.wk-popup`'s `background` declaration now, so a custom prefix gets a **fully transparent popup**, and `backgroundOpacity` becomes a complete no-op. If you set `classPrefix`, supply your own stylesheet covering the whole class table above. Do not import `which-key/styles.css` alongside it and expect a partial effect; there is none.
>
> `classPrefix` is **vanilla-only**. The React components always emit `wk-`.

### Theming

The shipped stylesheet ships dark by default — a consumer who does nothing sees no change. It automatically follows the `prefers-color-scheme: light` media query, and an author can force either theme regardless of OS preference with `data-wk-theme="light"` or `data-wk-theme="dark"` on `<html>` — specifically the document root; an ancestor further down the tree will not work. The override selectors are `:root`-scoped, which matches only the actual document root element, so the palette they set is visible wherever the popup or cheatsheet render, including the vanilla renderer's popup host, which is appended to `document.body` rather than nested under the consumer's markup.

Force light regardless of OS preference:

```html
<html data-wk-theme="light"></html>
```

Force dark regardless of OS preference:

```html
<html data-wk-theme="dark"></html>
```

All colours are `--wk-*` custom properties, so overriding one is the same as overriding any other CSS variable:

```css
:root {
  --wk-focus-ring: #f59e0b;
}
```

| Property               | Dark default (shipped)                                                    | Light value                                                                 |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `--wk-panel-bg`        | `#111827`                                                                 | `#ffffff`                                                                   |
| `--wk-panel-bg-rgb`    | `17, 24, 39`                                                              | `255, 255, 255`                                                             |
| `--wk-chip-bg`         | `#374151`                                                                 | `#f3f4f6`                                                                   |
| `--wk-border`          | `#374151`                                                                 | `#d1d5db`                                                                   |
| `--wk-text`            | `#f3f4f6`                                                                 | `#111827`                                                                   |
| `--wk-text-muted`      | `#9ca3af`                                                                 | `#4b5563`                                                                   |
| `--wk-text-subtle`     | `#6b7280`                                                                 | `#6b7280`                                                                   |
| `--wk-row-label`       | `#e5e7eb`                                                                 | `#1f2937`                                                                   |
| `--wk-row-label-group` | `#93c5fd`                                                                 | `#1d4ed8`                                                                   |
| `--wk-focus-ring`      | `#93c5fd`                                                                 | `#1d4ed8`                                                                   |
| `--wk-backdrop-bg`     | `rgba(0, 0, 0, 0.5)`                                                      | `rgba(0, 0, 0, 0.35)`                                                       |
| `--wk-shadow-chip`     | `0 1px 2px rgba(0, 0, 0, 0.05)`                                           | `0 1px 2px rgba(0, 0, 0, 0.08)`                                             |
| `--wk-shadow-panel`    | `0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)` | `0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.15)` |

The popup's `backgroundOpacity` prop/option (`<WhichKeyPopup>` and `mountWhichKey`) sets only the `--wk-popup-bg-opacity` custom property inline; the colour itself always comes from `--wk-panel-bg-rgb` in CSS, so the popup repaints correctly under either theme instead of staying pinned to one background.

> `--wk-z-index`/`--wk-z-index-backdrop`, documented under [Stacking order](#stacking-order) just below, are part of this same `--wk-*` custom-property surface.

### Stacking order

The overlay's `z-index` is exposed as a CSS custom property so you can place which-key relative to your own modal layer without out-specifying the shipped selectors:

| Property                | Default             | Applies to                                        |
| ----------------------- | ------------------- | ------------------------------------------------- |
| `--wk-z-index`          | `1000`              | `.wk-popup`, and `.wk-backdrop` unless overridden |
| `--wk-z-index-backdrop` | `var(--wk-z-index)` | `.wk-backdrop` only                               |

```css
:root {
  --wk-z-index: 1400; /* above MUI's modal layer (1300) */
}
```

The default of `1000` clears Ant Design's modal layer but sits below Bootstrap's `.modal` (1055) and MUI's modal (1300) — raise it if you need the cheatsheet over one of those.

---

## Troubleshooting

which-key's failure mode is almost always "nothing happens". Work down this list.

**1. Is `<WhichKeyProvider>` an ancestor, and did you call `engine.start()`?**
The React hooks and both renderer components warn on the console when they are used outside the provider. The engine does not attach its `keydown` listener until `start()` is called — `mountWhichKey` deliberately does **not** call it for you.

**2. Is focus in a text field?**
Shortcuts are suppressed while focus is in an `<input>`, `<textarea>` or `contenteditable` element unless you register them with `enableOnInputs: true`.

**3. Does your key string canonicalize to what the browser actually reports?**
This is the most common silent failure. Registration and runtime both funnel through the same canonicalizer and the registry looks up plain strings, so a mismatch means the lookup simply misses:

```ts
import { parseKey, eventToCanonical } from 'which-key';

document.addEventListener('keydown', (e) => {
  console.log('pressed:', eventToCanonical(e), 'registered:', parseKey('g'));
});
```

If those two differ for the same physical keypress, that is your bug. Watch for: letters uppercase under any modifier (`parseKey('ctrl+k')` → `'Ctrl+K'`); `Shift+` dropped for punctuation and digits, which silently rebinds to the _unshifted_ character (`parseKey('Shift+/')` → `'/'`, not `'?'` — write `register('?', ...)` directly; the library warns when it detects this); and special key names — `'escape'`, `'esc'`, `'up'` and `'f1'` are all accepted case-insensitively and round-trip correctly against the real event (`'Escape'`, `'ArrowUp'`, `'F1'`). A base that isn't one of these recognised names or aliases still registers, but now warns that the binding may never match; if the browser genuinely reports that exact spelling (an exotic `event.key` like `'MediaPlayPause'`), the warning is a false positive you can ignore, but a typo is far more likely.

**4. Is an exclusive layer active?**
An exclusive layer makes every shortcut below its level unreachable. Register with `global: true` to punch through, or check what is live with `engine.registry.getAllActive()`.

**5. Is another registration winning?**
Multiple components may bind the same key. The winner is decided by **level, then priority, then most-recent registration**. A same-level collision emits a console warning naming both entries; raise the loser's `priority` or unregister one.

### Console warnings

which-key writes diagnostics to the console prefixed with `[whichkey]`. Nearly all are `console.warn` advisories for consumer misuse; one is a `console.error` logged when your own shortcut handler throws. None of them propagates an exception into your app. See the [warning reference](https://github.com/stevenwcarter/which-key/blob/main/docs/API.md#console-warnings) for what each one means.

---

## API

See **[docs/API.md](https://github.com/stevenwcarter/which-key/blob/main/docs/API.md)** for the full reference.

---

## Coverage

The test suite is gated at **80%** (lines, statements, functions, branches). `npm test` runs Vitest with V8 coverage and prints a report; CI uploads results to Codecov.

---

## Contributing

See **[CONTRIBUTING.md](https://github.com/stevenwcarter/which-key/blob/main/CONTRIBUTING.md)**.

---

## Releasing

Versioning is driven by [Conventional Commits](https://www.conventionalcommits.org/).
The version bump and changelog are derived from commit messages since the last tag.
While the package is pre-1.0 (`0.x`), semver-for-0.x rules apply:

- `fix: …` → patch (e.g. `0.2.0` → `0.2.1`)
- `feat: …` → **patch** while `0.x` (the public API is still unstable)
- `feat!: …` or a `BREAKING CHANGE:` footer → **minor** while `0.x` (`0.2.0` → `0.3.0`)

(After the project cuts `1.0.0`, the usual rules resume: `feat:`→minor, `feat!:`→major.)

Commit messages are linted by a husky `commit-msg` hook (`@commitlint/config-conventional`).

**First release (one-time):** the default first bump with no prior tag would be a patch
(`0.1.1`); to start at `0.2.0` instead, force a minor once:

```bash
npm run release -- --release-as minor   # 0.1.0 → 0.2.0, writes CHANGELOG.md, tags v0.2.0
```

**Ongoing releases:**

```bash
npm run release:dry   # preview the next version + changelog (no changes)
npm run release       # bump package.json, regenerate CHANGELOG.md, commit, and tag
```

`npm run release` does not push or publish. After it succeeds, publish manually:

```bash
git push --follow-tags origin main
npm publish           # prepublishOnly rebuilds dist/ first
```

To intentionally cut `1.0.0`: `npm run release -- --release-as major`.

---

## License

MIT © Steven Carter
