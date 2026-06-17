# which-key

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
| `Shift+/` | `Shift` + `/`                              |
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

## Styling

Import the prebuilt stylesheet:

```ts
import 'which-key/styles.css';
```

Or bring your own by targeting the `wk-*` CSS class contract. All classes use the `wk-` prefix (or whatever you pass as `classPrefix` to `mountWhichKey`):

| Class                   | Element                                   |
|-------------------------|-------------------------------------------|
| `wk-popup`              | Popup container                           |
| `wk-popup--vertical`    | Modifier: corner popup layout             |
| `wk-popup--horizontal`  | Modifier: bottom-bar layout               |
| `wk-popup__header`      | Header area (vertical layout)             |
| `wk-popup__body`        | Body area (horizontal layout)             |
| `wk-popup__list`        | Candidate list (vertical layout)          |
| `wk-popup__grid`        | Candidate grid (horizontal layout)        |
| `wk-row`                | Single candidate row                      |
| `wk-row--group`         | Modifier: row represents a group          |
| `wk-row__label`         | Candidate label text                      |
| `wk-kbd`                | `<kbd>` key chip                          |
| `wk-sequence`           | Current-sequence display                  |
| `wk-sequence__ellipsis` | `…` trailing the current sequence         |
| `wk-cheatsheet`         | Cheatsheet backdrop/container             |

Custom `classPrefix` example (vanilla only):

```ts
mountWhichKey(wk, { classPrefix: 'myapp' });
// produces: myapp-popup, myapp-kbd, etc.
```

---

## API

See **[docs/API.md](./docs/API.md)** for the full reference.

---

## Migration

Migrating from an inlined `@whichkey/core` / `@whichkey/ui`? See **[docs/MIGRATION.md](./docs/MIGRATION.md)**.

---

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

---

## License

MIT © Steven Carter
