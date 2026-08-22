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
import { WhichKeyProvider, useShortcut, useShortcutGroup, WhichKeyPopup, ShortcutCheatsheet } from 'which-key/react';
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

| String    | Meaning                                    |
|-----------|--------------------------------------------|
| `s`       | Single key `s`                             |
| `g h`     | Leader sequence: press `g`, then `h`       |
| `Ctrl+s`  | `Control` + `s`                            |
| `Alt+x`   | `Alt` (or `Option` on macOS) + `x`        |
| `?`       | The shifted character itself — write `?`, not `Shift+/` |
| `Cmd+k`   | `Command` (macOS) + `k`                   |
| `Mod+s`   | `Cmd` on macOS, `Ctrl` elsewhere           |

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

| Value              | Behavior                                        |
|--------------------|-------------------------------------------------|
| `'registration'`   | (default) Shortcuts appear in registration order |
| `'alphabetical'`   | Sorted A–Z by key string                        |
| custom comparator  | `(a: string, b: string) => number`              |

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

| Property / method        | Description                                                         |
|--------------------------|---------------------------------------------------------------------|
| `level`                  | Numeric level assigned to this layer                                |
| `register(keys, fn, opts?)` | Register a shortcut bound to this layer                          |
| `registerGroup(prefix, opts)` | Register a group label bound to this layer                   |
| `pop()`                  | Unregister all shortcuts on this layer and deactivate the layer     |

**React**

Wrap the modal (or any conditional UI) in `<WhichKeyLayer>`. Every `useShortcut` and `useShortcutGroup` call inside it automatically binds to that layer. The layer activates on mount and deactivates on unmount — no manual cleanup needed.

```tsx
import {
  WhichKeyProvider, WhichKeyLayer,
  useShortcut, WhichKeyPopup, ShortcutCheatsheet,
} from 'which-key/react';
import { useState } from 'react';

function Modal({ onClose }: { onClose: () => void }) {
  // These shortcuts only fire while the modal is mounted.
  useShortcut('Escape', onClose, { description: 'Close' });
  useShortcut('j', () => console.log('next'), { description: 'Next item' });
  useShortcut('k', () => console.log('prev'), { description: 'Previous item' });
  return (
    <div role="dialog">
      <p>Modal open — press <kbd>j</kbd>/<kbd>k</kbd> to navigate, <kbd>Escape</kbd> to close.</p>
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

Or bring your own by targeting the `wk-*` CSS class contract. All classes use the `wk-` prefix (or whatever you pass as `classPrefix` to `mountWhichKey`):

| Class                         | Element                                          |
|-------------------------------|--------------------------------------------------|
| `wk-popup`                    | Popup container                                  |
| `wk-popup-host`               | Structural wrapper holding the popup; unstyled   |
| `wk-popup--vertical`          | Modifier: corner popup layout                    |
| `wk-popup--horizontal`        | Modifier: bottom-bar layout                      |
| `wk-popup__header`            | Header area (vertical layout)                    |
| `wk-popup__body`              | Body area (horizontal layout)                    |
| `wk-popup__list`              | Candidate list (vertical layout)                 |
| `wk-popup__grid`              | Candidate grid (horizontal layout)               |
| `wk-row`                      | Single candidate row                             |
| `wk-row--group`               | Modifier: row represents a group                 |
| `wk-row__label`               | Candidate label text                             |
| `wk-kbd`                      | `<kbd>` key chip                                 |
| `wk-sequence`                 | Current-sequence display                         |
| `wk-sequence__ellipsis`       | `…` trailing the current sequence                |
| `wk-backdrop`                 | Full-screen dimmed overlay behind the cheatsheet |
| `wk-cheatsheet`               | Cheatsheet panel (scrollable content box)        |
| `wk-cheatsheet__close`        | Close button in the cheatsheet panel             |
| `wk-cheatsheet__title`        | Cheatsheet heading                               |
| `wk-cheatsheet__sections`     | Wrapper around all cheatsheet sections           |
| `wk-cheatsheet__section`      | One group's section                              |
| `wk-cheatsheet__list`         | List of shortcut entries                         |
| `wk-cheatsheet__list--nested` | Modifier: list nested under a group              |
| `wk-cheatsheet__item`         | One shortcut entry                               |
| `wk-cheatsheet__group-title`  | Group heading row                                |
| `wk-cheatsheet__group-label`  | Group description text                           |
| `wk-cheatsheet__hint`         | "Press Escape to close" footer                   |

Custom `classPrefix` example (vanilla only):

```ts
mountWhichKey(wk, { classPrefix: 'myapp' });
// produces: myapp-popup, myapp-kbd, etc.
```

---

## API

See **[docs/API.md](./docs/API.md)** for the full reference.

---

## Coverage

The test suite is gated at **80%** (lines, statements, functions, branches). `npm test` runs Vitest with V8 coverage and prints a report; CI uploads results to Codecov.

---

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

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
