# which-key API Reference

## Table of contents

1. [Engine — `which-key`](#engine--which-key)
   - [`createWhichKey(options?)`](#createwhichkeyoptions)
   - [`WhichKeyEngine`](#whichkeyengine)
   - [`WhichKeySnapshot`](#whichkeysnapshot)
   - [`CheatsheetModel`](#cheatsheetmodel)
2. [React — `which-key/react`](#react--which-keyreact)
   - [`<WhichKeyProvider>`](#whichkeyprovider)
   - [`useShortcut(keys, handler, options?)`](#useshortcutkeys-handler-options)
   - [`useShortcutGroup(prefix, options)`](#useshortcutgroupprefix-options)
   - [`useWhichKeyState(what?)`](#usewhichkeystatewhat)
   - [`<WhichKeyPopup>`](#whichkeypopup)
   - [`<ShortcutCheatsheet>`](#shortcutcheatsheet)
3. [Vanilla — `which-key/vanilla`](#vanilla--which-keyvanilla)
   - [`mountWhichKey(engine, options?)`](#mountwhichkeyengine-options)
4. [Key-string syntax](#key-string-syntax)
5. [CSS class contract (`wk-*`)](#css-class-contract-wk-)

---

## Engine — `which-key`

### `createWhichKey(options?)`

Creates and returns a `WhichKeyEngine` instance.

```ts
import { createWhichKey } from 'which-key';

const wk = createWhichKey({
  timeoutMs: 500,
  helpKey: '?',
  sortKeys: 'alphabetical',
});
```

**Options** (`WhichKeyOptions`):

| Property    | Type                                        | Default         | Description                                                                 |
|-------------|---------------------------------------------|-----------------|-----------------------------------------------------------------------------|
| `timeoutMs` | `number`                                    | `500`           | Milliseconds of inactivity before a partial sequence is cancelled. A non-finite or negative value emits a `console.warn` and falls back to `500`. |
| `helpKey`   | `string \| null`                            | `'?'`           | Key that opens the cheatsheet. `null` disables the built-in help shortcut. An unparseable value emits a `console.warn` and disables the help shortcut; it never throws. |
| `sortKeys`  | `'registration' \| 'alphabetical' \| KeyComparator` | `'registration'` | Controls the order of candidates in the popup and cheatsheet.               |
| `target`    | `Document \| HTMLElement`                   | `document`      | DOM node on which the `keydown` listener is installed.                      |

`KeyComparator` is `(a: string, b: string) => number` — the same contract as `Array.prototype.sort`.

---

### `WhichKeyEngine`

The object returned by `createWhichKey`.

#### <a id="engine-register"></a>`engine.register(keys, handler, options?) => () => void`

Registers a keyboard shortcut and returns an unregister function.

```ts
const off = wk.register('Ctrl+s', (event) => save(), {
  description: 'Save',
  enableOnInputs: false,  // skip if focus is inside <input> / <textarea> / etc.
  priority: 0,
  enabled: true,
});

// later:
off(); // unregister
```

> **Invalid input soft-fails.** If `keys` cannot be parsed (empty string, unknown modifier, dangling `+`) or `handler` is not a function, `register` emits a `console.warn` and returns a no-op unregister function rather than throwing. This keeps `useShortcut` — which calls `register` from inside an effect — from tearing down the consumer's React tree on a typo.

**Options** (`ShortcutOptions`):

| Property        | Type      | Default | Description                                                                    |
|-----------------|-----------|---------|--------------------------------------------------------------------------------|
| `description`   | `string`  | —       | Human-readable label shown in the popup and cheatsheet.                        |
| `enableOnInputs`| `boolean` | `false` | When `false`, the shortcut is suppressed while focus is in a text input.       |
| `priority`      | `number`  | `0`     | Higher wins when multiple entries share the same key string.                   |
| `enabled`       | `boolean` | `true`  | Dynamically enable/disable without unregistering.                              |

#### `engine.registerGroup(prefix, options) => () => void`

Annotates a key prefix with a human-readable description displayed in the popup.

```ts
const off = wk.registerGroup('g', { description: 'Go to', priority: 0 });
```

**Options**:

| Property      | Type     | Default | Description                                        |
|---------------|----------|---------|----------------------------------------------------|
| `description` | `string` | (required) | Label shown in the popup for this prefix.       |
| `priority`    | `number` | `0`     | Higher priority groups sort earlier when combined. |

Returns an unregister function.

#### `engine.start() => void`

Attaches the `keydown` listener to the configured `target`. Safe to call multiple times (idempotent after the first call).

#### `engine.stop() => void`

Detaches the `keydown` listener and cancels any in-progress sequence. Idempotent.

#### `engine.subscribe(listener) => () => void`

Subscribes to state changes. The listener is called with the new `WhichKeySnapshot` after every state change. Returns an unsubscribe function.

```ts
const off = wk.subscribe((snap) => {
  console.log('popup visible:', snap.popup.visible);
});
off(); // unsubscribe
```

#### `engine.getSnapshot() => WhichKeySnapshot`

Returns the current snapshot synchronously. Useful for initial render and `useSyncExternalStore` integrations.

#### `engine.openCheatsheet() => void`

Opens the cheatsheet (no-op if already open).

#### `engine.closeCheatsheet() => void`

Closes the cheatsheet (no-op if already closed).

#### `engine.toggleCheatsheet() => void`

Toggles the cheatsheet.

#### `engine.cancel() => void`

Cancels any in-progress key sequence and hides the popup.

#### `engine.getCheatsheetModel() => CheatsheetModel`

Returns the current cheatsheet data model. Useful for building custom cheatsheet UIs.

#### `engine.registry`

Read-only reference to the underlying `ShortcutRegistry`. Advanced use only.

---

### `WhichKeySnapshot`

```ts
type WhichKeySnapshot = {
  popup: {
    visible: boolean;
    currentSequence: string[];   // keys pressed so far, e.g. ['g']
    candidates: WhichKeyCandidate[];
  };
  cheatsheet: {
    visible: boolean;
  };
};

type WhichKeyCandidate = {
  keys: string;              // full key string of the shortcut, e.g. 'g h'
  nextKey: string;           // the next key to press, e.g. 'h'
  description: string | undefined;
  isGroup: boolean;          // true if this candidate is a group prefix
};
```

---

### `CheatsheetModel`

```ts
type CheatsheetModel = {
  standalone: CheatsheetEntry[];   // single-key shortcuts (no group)
  groups: CheatsheetGroup[];       // shortcuts grouped by prefix
};

type CheatsheetEntry = {
  keys: string;
  description: string | undefined;
};

type CheatsheetGroup = {
  prefix: string;
  description: string | undefined;
  entries: CheatsheetEntry[];
};
```

---

## React — `which-key/react`

All engine types and functions are re-exported from `which-key/react`, so you can import everything from one entry point when using React.

### `<WhichKeyProvider>`

Creates the engine, starts it on mount, and stops it on unmount. Must wrap any component that calls `useShortcut`, `useShortcutGroup`, or `useWhichKeyState`.

```tsx
import { WhichKeyProvider } from 'which-key/react';

<WhichKeyProvider
  timeoutMs={500}
  helpKey="?"
  sortKeys="alphabetical"
>
  {children}
</WhichKeyProvider>
```

**Props** (`WhichKeyProviderProps`):

| Prop        | Type                                                  | Default         | Description                              |
|-------------|-------------------------------------------------------|-----------------|------------------------------------------|
| `timeoutMs` | `number`                                              | `500`           | Sequence timeout in milliseconds.        |
| `helpKey`   | `string \| null`                                      | `'?'`           | Cheatsheet toggle key. `null` to disable.|
| `sortKeys`  | `'registration' \| 'alphabetical' \| KeyComparator`   | `'registration'`| Popup/cheatsheet sort order.             |
| `children`  | `ReactNode`                                           | (required)      |                                          |

> **Mount-time props:** `timeoutMs`, `helpKey`, and `sortKeys` are read once when the provider mounts; changing them on later renders has no effect (the engine is created once and lives for the lifetime of the provider).

> **SSR / client-only:** `<WhichKeyPopup>` and `<ShortcutCheatsheet>` render nothing during server rendering and activate after hydration on the client — they are client-only UI components.

### `useShortcut(keys, handler, options?)`

Registers a shortcut for the lifetime of the component. Re-registers automatically if `keys` or `options` change.

```tsx
useShortcut('Ctrl+s', () => save(), { description: 'Save document' });
useShortcut('g h', () => navigate('/'), { description: 'Home' });
```

Parameters mirror `engine.register` — see [`ShortcutOptions`](#engine-register) above.

### `useShortcutGroup(prefix, options)`

Registers a group annotation for the lifetime of the component.

```tsx
useShortcutGroup('g', { description: 'Go to' });
```

Options mirror `engine.registerGroup`.

### `useWhichKeyState(what?)`

Returns the current `WhichKeyState` (a view of the snapshot shaped for React rendering). Subscribes to updates via `useSyncExternalStore`.

| Parameter | Type     | Default                | Description                                                                                     |
|-----------|----------|------------------------|-------------------------------------------------------------------------------------------------|
| `what`    | `string` | `'useWhichKeyState()'` | Label used in the "used outside `<WhichKeyProvider>`" console warning. Set by `<WhichKeyPopup>` so the warning names the component; consumers rarely need it. |

```ts
type WhichKeyState = {
  visible: boolean;
  currentSequence: string[];
  candidates: WhichKeyCandidate[];
  cancel: () => void;
};
```

### `<WhichKeyPopup>`

Renders the leader-key popup. Returns `null` when the popup is not visible.

```tsx
import { WhichKeyPopup } from 'which-key/react';

<WhichKeyPopup layout="horizontal" maxRows={5} backgroundOpacity={0.95} />
```

**Props** (`WhichKeyPopupProps`):

| Prop                | Type                          | Default    | Description                                              |
|---------------------|-------------------------------|------------|----------------------------------------------------------|
| `layout`            | `'vertical' \| 'horizontal'` | `'vertical'`| Corner popup (`vertical`) or bottom bar (`horizontal`). |
| `maxRows`           | `number`                      | `5`        | Maximum rows in the horizontal grid.                     |
| `backgroundOpacity` | `number`                      | `0.95`     | Panel background alpha (0–1).                            |

### `<ShortcutCheatsheet>`

Renders the full-screen cheatsheet. Returns `null` when the cheatsheet is not visible. No props.

```tsx
import { ShortcutCheatsheet } from 'which-key/react';

<ShortcutCheatsheet />
```

---

## Vanilla — `which-key/vanilla`

### `mountWhichKey(engine, options?) => { unmount() }`

Subscribes a vanilla-DOM renderer to the engine. Returns an object with an `unmount()` method.

> **Important:** `mountWhichKey` does **not** call `engine.start()`. You must call `engine.start()` yourself to attach the keydown listener.

```ts
import { createWhichKey } from 'which-key';
import { mountWhichKey } from 'which-key/vanilla';

const wk = createWhichKey();
const { unmount } = mountWhichKey(wk, {
  popup: { layout: 'horizontal', maxRows: 5, backgroundOpacity: 0.95 },
  cheatsheet: true,
  container: document.getElementById('app')!,
  classPrefix: 'wk',
});

wk.start();

// tear down everything:
unmount();
wk.stop();
```

**Options** (`MountOptions`):

| Property      | Type                              | Default         | Description                                                        |
|---------------|-----------------------------------|-----------------|--------------------------------------------------------------------|
| `popup`       | `Partial<PopupOptions> \| false`  | `{}`            | Popup renderer options. Pass `false` to suppress the popup.        |
| `cheatsheet`  | `boolean`                         | `true`          | Whether to render the cheatsheet.                                  |
| `container`   | `HTMLElement`                     | `document.body` | DOM node into which rendered elements are appended.                |
| `classPrefix` | `string`                          | `'wk'`          | CSS class prefix (replaces `wk-` with `<classPrefix>-`).           |

**`PopupOptions`** (values inside `popup: {}`):

| Property            | Type                          | Default      | Description                        |
|---------------------|-------------------------------|--------------|------------------------------------|
| `layout`            | `'vertical' \| 'horizontal'` | `'vertical'` | Popup layout.                      |
| `maxRows`           | `number`                      | `5`          | Max rows in the horizontal grid.   |
| `backgroundOpacity` | `number`                      | `0.95`       | Panel alpha (0–1).                 |

---

## Key-string syntax

Keys are expressed as strings. Sequences use a single space as the separator.

### Modifiers

| Modifier   | Aliases / notes                                 |
|------------|-------------------------------------------------|
| `Ctrl+`    | Control key on all platforms                    |
| `Alt+`     | Alt / Option on macOS                           |
| `Shift+`   | Shift                                           |
| `Cmd+`     | Command (macOS); does nothing on Windows/Linux  |
| `Mod+`     | `Cmd` on macOS, `Ctrl` on Windows/Linux         |

Modifier names are case-insensitive. Multiple modifiers may be combined: `Ctrl+Shift+p`, `Mod+Alt+f`.

### Examples

```
s              →  plain s
g n            →  leader sequence: g then n
Ctrl+s         →  Control+s
Mod+k g        →  (Cmd/Ctrl)+k, then g
?              →  ?  (write the shifted character directly, not "Shift+/")
```

---

## CSS class contract (`wk-*`)

The prebuilt stylesheet (`which-key/styles.css`) and the vanilla renderer both use this class set. Most classes carry the default theme's styling and can be overridden to customize appearance; a few (like `wk-popup-host`) are deliberately unstyled structural hooks the theme leaves alone.

| Class                         | Element                                          |
|-------------------------------|--------------------------------------------------|
| `wk-popup`                    | Popup container                                  |
| `wk-popup-host`               | Structural wrapper holding the popup; unstyled   |
| `wk-popup--vertical`          | Modifier: corner popup (right-aligned, bottom)   |
| `wk-popup--horizontal`        | Modifier: bottom bar spanning the viewport       |
| `wk-popup__header`            | Header row (vertical layout)                     |
| `wk-popup__body`              | Body wrapper (horizontal layout)                 |
| `wk-popup__list`              | `<ul>` candidate list (vertical)                 |
| `wk-popup__grid`              | CSS grid of candidates (horizontal)              |
| `wk-row`                      | Single candidate entry                           |
| `wk-row--group`               | Modifier: candidate is a group prefix            |
| `wk-row__label`               | Candidate description text                       |
| `wk-kbd`                      | `<kbd>` key chip                                 |
| `wk-sequence`                 | Pressed-sequence display                         |
| `wk-sequence__ellipsis`       | `…` appended to the pressed sequence             |
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

When using a custom `classPrefix` (e.g. `'myapp'`), replace `wk-` with `myapp-` throughout.
