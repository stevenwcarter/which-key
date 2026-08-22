# which-key API Reference

## Table of contents

1. [Engine — `which-key`](#engine--which-key)
   - [`createWhichKey(options?)`](#createwhichkeyoptions)
   - [`WhichKeyEngine`](#whichkeyengine)
   - [`WhichKeySnapshot`](#whichkeysnapshot)
   - [`CheatsheetModel`](#cheatsheetmodel)
2. [React — `which-key/react`](#react--which-keyreact)
   - [`<WhichKeyProvider>`](#whichkeyprovider)
   - [`<WhichKeyLayer>`](#whichkeylayer)
   - [`useShortcut(keys, handler, options?)`](#useshortcutkeys-handler-options)
   - [`useShortcutGroup(prefix, options)`](#useshortcutgroupprefix-options)
   - [`useWhichKeyState(what?)`](#usewhichkeystatewhat)
   - [`<WhichKeyPopup>`](#whichkeypopup)
   - [`<ShortcutCheatsheet>`](#shortcutcheatsheet)
3. [Vanilla — `which-key/vanilla`](#vanilla--which-keyvanilla)
   - [`mountWhichKey(engine, options?) => WhichKeyMountHandle`](#mountwhichkey)
4. [Debugging](#debugging)
5. [Key-string syntax](#key-string-syntax)
6. [CSS class contract (`wk-*`)](#css-class-contract-wk-)

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

| Property    | Type                                                | Default          | Description                                                                                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeoutMs` | `number`                                            | `500`            | Milliseconds of inactivity before a partial sequence is cancelled. A non-finite or negative value emits a `console.warn` and falls back to `500`.                                                                                                                                                                               |
| `helpKey`   | `string \| null`                                    | `'?'`            | Key that opens the cheatsheet. `null` disables the built-in help shortcut silently — this is the documented way to opt out. `''` also disables it but emits a `console.warn`, since an empty string is almost certainly a mistake. An unparseable value emits a `console.warn` and disables the help shortcut; it never throws. |
| `sortKeys`  | `'registration' \| 'alphabetical' \| KeyComparator` | `'registration'` | Controls the order of candidates in the popup and cheatsheet.                                                                                                                                                                                                                                                                   |
| `target`    | `Document \| HTMLElement`                           | `document`       | DOM node on which the `keydown` listener is installed.                                                                                                                                                                                                                                                                          |

`KeyComparator` is `(a: string, b: string) => number` — the same contract as `Array.prototype.sort`.

---

### `WhichKeyEngine`

The object returned by `createWhichKey`.

#### <a id="engine-register"></a>`engine.register(keys, handler, options?) => () => void`

Registers a keyboard shortcut and returns an unregister function.

```ts
const off = wk.register('Ctrl+s', (event) => save(), {
  description: 'Save',
  enableOnInputs: false, // skip if focus is inside <input> / <textarea> / etc.
  priority: 0,
  enabled: true,
});

// later:
off(); // unregister
```

> **Invalid input soft-fails.** If `keys` cannot be parsed (empty string, unknown modifier, dangling `+`) or `handler` is not a function, `register` emits a `console.warn` and returns a no-op unregister function rather than throwing. This keeps `useShortcut` — which calls `register` from inside an effect — from tearing down the consumer's React tree on a typo.

**Options** (`ShortcutOptions`):

| Property         | Type      | Default | Description                                                                                                                                                                                                                            |
| ---------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description`    | `string`  | —       | Human-readable label shown in the popup and cheatsheet.                                                                                                                                                                                |
| `enableOnInputs` | `boolean` | `false` | When `false`, the shortcut is suppressed while focus is in a text input.                                                                                                                                                               |
| `priority`       | `number`  | `0`     | Higher wins when multiple entries share the same key string.                                                                                                                                                                           |
| `enabled`        | `boolean` | `true`  | Dynamically enable/disable without unregistering.                                                                                                                                                                                      |
| `global`         | `boolean` | `false` | When `true`, this shortcut stays reachable even under an active exclusive layer.                                                                                                                                                       |
| `level`          | `number`  | `0`     | Layer level this registration belongs to. Normally set for you by `pushLayer` / `<WhichKeyLayer>` — most callers never set it directly. Must be a non-negative integer; an invalid value emits a `console.warn` and falls back to `0`. |

#### `engine.registerGroup(prefix, options) => () => void`

Annotates a key prefix with a human-readable description displayed in the popup.

```ts
const off = wk.registerGroup('g', { description: 'Go to', priority: 0 });
```

**Options**:

| Property      | Type     | Default    | Description                                                                                                                                                                                |
| ------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | `string` | (required) | Label shown in the popup for this prefix.                                                                                                                                                  |
| `priority`    | `number` | `0`        | Higher priority groups sort earlier when combined.                                                                                                                                         |
| `level`       | `number` | `0`        | Layer level this group belongs to. Normally set for you by `pushLayer` / `<WhichKeyLayer>`. Must be a non-negative integer; an invalid value emits a `console.warn` and falls back to `0`. |

Returns an unregister function.

#### `engine.pushLayer(options?) => LayerHandle`

Pushes a new keybinding layer and returns a handle that owns everything registered through it. This is the recommended way to scope shortcuts to a modal, drawer, or focused pane: `pop()` unregisters every shortcut and group the handle created **and** deactivates the layer, so there is no teardown bookkeeping to get wrong.

```ts
const layer = engine.pushLayer({ exclusive: true });
layer.register('Escape', close, { description: 'Close dialog' });
layer.registerGroup('g', { description: 'Go to' });
// later:
layer.pop(); // unregisters both, then deactivates the layer
```

**Options**:

| Property    | Type      | Default                | Description                                                                                                                                                                                                                           |
| ----------- | --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exclusive` | `boolean` | `false`                | When `true`, this layer raises the block level: shortcuts and groups at a lower level become unreachable unless registered with `global: true`. When `false`, the layer is additive — lower-level shortcuts keep firing alongside it. |
| `level`     | `number`  | `registry.nextLevel()` | Explicit level ordinal. Must be a non-negative integer.                                                                                                                                                                               |

> **Level validation.** An invalid `level` (not a non-negative integer) emits a `console.warn` and falls back to the next free level. A _valid_ explicit `level` that undercuts the next free level (e.g. reusing a lower number while a higher layer is already active) emits a separate advisory `console.warn` but still activates at the requested level — this can leave the new layer's shortcuts blocked by an already-active exclusive layer above it.

**`LayerHandle`**:

```ts
type LayerHandle = {
  readonly level: number;
  register(keys: string, handler: ShortcutHandler, options?: ShortcutOptions): () => void;
  registerGroup(
    prefix: string,
    options: { description: string; priority?: number; level?: number },
  ): () => void;
  pop(): void;
};
```

`register` and `registerGroup` behave exactly like the engine methods of the same name, except each stamps this handle's `level` onto the registration and tracks it so `pop()` can unregister it later. `pop()` is idempotent.

#### `engine.activateLayer(level, exclusive) => () => void`

Lower-level primitive: activates a layer at an explicit level without owning any registrations. Returns a deactivate function that is safe to call more than once — only the first call has effect. Prefer `pushLayer` unless you are managing registration lifetimes yourself.

```ts
const deactivate = engine.activateLayer(1, true);
// ... later
deactivate();
```

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

Reference to the underlying `ShortcutRegistry`. Advanced use only — treat it as read-only. The supported read method is `getAllActive()`, documented under [Debugging](#debugging). The mutating methods (`register`, `unregister`, `activateLayer`) exist on the class but are driven by the engine; calling them directly bypasses the engine's bookkeeping.

---

### `WhichKeySnapshot`

```ts
type WhichKeySnapshot = {
  popup: {
    visible: boolean;
    currentSequence: string[]; // keys pressed so far, e.g. ['g']
    candidates: WhichKeyCandidate[];
  };
  cheatsheet: {
    visible: boolean;
  };
};

type WhichKeyCandidate = {
  keys: string; // full key string of the shortcut, e.g. 'g h'
  nextKey: string; // the next key to press, e.g. 'h'
  description: string | undefined;
  isGroup: boolean; // true if this candidate is a group prefix
};
```

---

### `CheatsheetModel`

```ts
type CheatsheetModel = {
  standalone: CheatsheetEntry[]; // single-key shortcuts (no group)
  groups: CheatsheetGroup[]; // shortcuts grouped by prefix
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

<WhichKeyProvider timeoutMs={500} helpKey="?" sortKeys="alphabetical">
  {children}
</WhichKeyProvider>;
```

**Props** (`WhichKeyProviderProps`):

| Prop        | Type                                                | Default          | Description                               |
| ----------- | --------------------------------------------------- | ---------------- | ----------------------------------------- |
| `timeoutMs` | `number`                                            | `500`            | Sequence timeout in milliseconds.         |
| `helpKey`   | `string \| null`                                    | `'?'`            | Cheatsheet toggle key. `null` to disable. |
| `sortKeys`  | `'registration' \| 'alphabetical' \| KeyComparator` | `'registration'` | Popup/cheatsheet sort order.              |
| `children`  | `ReactNode`                                         | (required)       |                                           |

> **Mount-time props:** `timeoutMs`, `helpKey`, and `sortKeys` are read once when the provider mounts; changing them on later renders has no effect (the engine is created once and lives for the lifetime of the provider).

> **SSR / client-only:** `<WhichKeyPopup>` and `<ShortcutCheatsheet>` render nothing during server rendering and activate after hydration on the client — they are client-only UI components.

### `<WhichKeyLayer>`

Scopes every `useShortcut` / `useShortcutGroup` call in its subtree to a nested keybinding layer. Mount it around a modal or focused pane; unmounting it deactivates the layer.

```tsx
<WhichKeyLayer exclusive>
  <Dialog />
</WhichKeyLayer>
```

**Props** (`WhichKeyLayerProps`):

| Prop        | Type        | Default    | Description                                                                                      |
| ----------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `children`  | `ReactNode` | (required) | Subtree whose shortcuts belong to this layer.                                                    |
| `exclusive` | `boolean`   | `false`    | When `true`, shortcuts at lower levels become unreachable unless registered with `global: true`. |

The layer's level is derived from React tree depth (`parent.level + 1`), so nesting `<WhichKeyLayer>` components stacks levels. Note that two **sibling** layers under the same parent share a level and therefore do not isolate from each other.

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

| Parameter | Type     | Default                | Description                                                                                                                                                   |
| --------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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

<WhichKeyPopup layout="horizontal" maxRows={5} backgroundOpacity={0.95} />;
```

**Props** (`WhichKeyPopupProps`):

| Prop                | Type                         | Default      | Description                                             |
| ------------------- | ---------------------------- | ------------ | ------------------------------------------------------- |
| `layout`            | `'vertical' \| 'horizontal'` | `'vertical'` | Corner popup (`vertical`) or bottom bar (`horizontal`). |
| `maxRows`           | `number`                     | `5`          | Maximum rows in the horizontal grid.                    |
| `backgroundOpacity` | `number`                     | `0.95`       | Panel background alpha (0–1).                           |

### `<ShortcutCheatsheet>`

Renders the full-screen cheatsheet. Returns `null` when the cheatsheet is not visible. No props.

```tsx
import { ShortcutCheatsheet } from 'which-key/react';

<ShortcutCheatsheet />;
```

---

## Vanilla — `which-key/vanilla`

### <a id="mountwhichkey"></a>`mountWhichKey(engine, options?) => WhichKeyMountHandle`

Subscribes a vanilla-DOM renderer to the engine. Returns an object with an `unmount()` method.

> **Important:** `mountWhichKey` does **not** call `engine.start()`. You must call `engine.start()` yourself to attach the keydown listener.

> **One mount per container.** Calling `mountWhichKey` again for a container that already has a live renderer emits a `console.warn` and returns a no-op handle — the existing mount stays authoritative. Call `unmount()` before re-mounting. `unmount()` is idempotent.

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

| Property      | Type                             | Default                                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `popup`       | `Partial<PopupOptions> \| false` | `{ layout: 'vertical', maxRows: 5, backgroundOpacity: 0.95 }` | Popup renderer options. Pass `false` to suppress the popup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `cheatsheet`  | `boolean`                        | `true`                                                        | Whether to render the cheatsheet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `container`   | `HTMLElement`                    | `document.body`                                               | DOM node into which rendered elements are appended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `classPrefix` | `string`                         | `'wk'`                                                        | CSS class prefix (replaces `wk-` with `<classPrefix>-`). Must be a valid CSS identifier stem (`/^-?[A-Za-z_][A-Za-z0-9_-]*$/`); an invalid value warns and falls back to `'wk'`. Setting it opts out of `which-key/styles.css` (which hardcodes `.wk-*` selectors, including the ones that read the `--wk-z-index`/`--wk-z-index-backdrop` custom properties) — supply your own stylesheet covering the class contract; importing the shipped sheet alongside a custom prefix has no partial effect. Vanilla only; the React components always emit `wk-`. |

**`PopupOptions`** (values inside `popup: {}`):

| Property            | Type                         | Default      | Description                      |
| ------------------- | ---------------------------- | ------------ | -------------------------------- |
| `layout`            | `'vertical' \| 'horizontal'` | `'vertical'` | Popup layout.                    |
| `maxRows`           | `number`                     | `5`          | Max rows in the horizontal grid. |
| `backgroundOpacity` | `number`                     | `0.95`       | Panel alpha (0–1).               |

**`WhichKeyMountHandle`** (the return value):

```ts
type WhichKeyMountHandle = { unmount(): void };
```

Both `PopupOptions` and `WhichKeyMountHandle` are exported as types from `which-key/vanilla`:

```ts
import type { MountOptions, PopupOptions, WhichKeyMountHandle } from 'which-key/vanilla';
```

---

## Key-string syntax

Keys are expressed as strings. Sequences use a single space as the separator.

### Modifiers

| Modifier | Aliases / notes                                |
| -------- | ---------------------------------------------- |
| `Ctrl+`  | Control key on all platforms                   |
| `Alt+`   | Alt / Option on macOS                          |
| `Shift+` | Shift                                          |
| `Cmd+`   | Command (macOS); does nothing on Windows/Linux |
| `Mod+`   | `Cmd` on macOS, `Ctrl` on Windows/Linux        |

Modifier names are case-insensitive. Multiple modifiers may be combined: `Ctrl+Shift+p`, `Mod+Alt+f`.

### Special keys

A base that names a special key is accepted **case-insensitively**, and the common short spellings below are also accepted as aliases. Both forms canonicalize to the exact `event.key` spelling the browser reports, so they match at runtime:

| Special key                                          | Aliases (case-insensitive)                     |
| ---------------------------------------------------- | ---------------------------------------------- |
| `Escape`                                             | `escape`, `esc`                                |
| `Tab`                                                | `tab`                                          |
| `Enter`                                              | `enter`                                        |
| `Backspace`                                          | `backspace`                                    |
| `Space`                                              | `space`, `spacebar`, literal `' '`             |
| `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` | `up`, `down`, `left`, `right`                  |
| `Home` / `End`                                       | `home`, `end`                                  |
| `PageUp` / `PageDown`                                | `pgup`, `pageup`, `pgdn`, `pagedn`, `pagedown` |
| `F1`–`F12`                                           | `f1`–`f12` (any casing)                        |

A base that is not one of the names above (or one of these aliases) is **not validated** — it passes through verbatim, since exotic-but-real `event.key` values (`'MediaPlayPause'`, `'BrowserBack'`, IME composition keys, …) must stay bindable. If it isn't a name any browser reports, the binding will never fire, and `parseKey` emits the `is not a key name this library recognises` warning (see [Console warnings](#console-warnings)) to flag it instead of failing silently.

### Examples

```
s              →  plain s
g n            →  leader sequence: g then n
Ctrl+s         →  Control+s
Mod+k g        →  (Cmd/Ctrl)+k, then g
?              →  ?  (write the shifted character directly, not "Shift+/")
```

---

## Debugging

When a shortcut "just doesn't fire", it is almost always one of three things: the key string canonicalizes differently than the runtime event, an exclusive layer is blocking it (see [`<WhichKeyLayer>`](#whichkeylayer)), or another registration is winning the collision. These exports let you check each from the console.

### `parseKey(keys)` / `parseSequence(keys)`

Canonicalize a key string exactly the way registration does. `parseKey` handles a single chord; `parseSequence` splits on spaces and returns an array of chords.

```ts
import { parseKey, parseSequence } from 'which-key';

parseKey('n'); // 'n'   — bare lowercase, no modifier implied
parseKey('N'); // 'N'   — a bare uppercase letter implies Shift was held
parseKey('Mod+k'); // 'Cmd+K' on macOS, 'Ctrl+K' elsewhere
parseKey('Shift+/'); // '/'   — Shift is dropped for punctuation (warns — see below)
parseSequence('g h'); // ['g', 'h']
```

Both **throw** for an unparseable string (an unknown modifier, a trailing `+`, an empty string). That is how you tell a typo from a mismatch. Contrast this with [`engine.register`](#engine-register), which catches that same error internally and **warns instead of throwing** — call `parseKey`/`parseSequence` yourself and a bad string is an exception; register it through the engine and a bad string is a console warning plus a no-op.

### `eventToCanonical(event)`

Canonicalize a live `KeyboardEvent` the way the matcher does at runtime. **Registration and runtime must produce byte-identical strings** — registry lookups are plain `Map` gets — so comparing the two is the fastest way to find a mismatch. Log both sides from a raw listener next to your registered key:

```ts
import { parseKey, eventToCanonical } from 'which-key';

document.addEventListener('keydown', (e) => {
  console.log('pressed:', eventToCanonical(e), '| registered:', parseKey('?'));
});
```

If those two strings differ, that is your bug. This is exactly what happens with the `Shift+/` example above: physically holding Shift and pressing `/` on a US layout delivers a `KeyboardEvent` whose `key` is already `'?'`, so `eventToCanonical(e)` reports `'?'`. But `parseKey('Shift+/')` reports `'/'` (see above) — the two never match, and a shortcut registered as `'Shift+/'` silently never fires. Registering the shifted character directly, `'?'`, fixes it.

### `engine.registry.getAllActive()`

Lists every shortcut currently winning its bucket — i.e. what would actually fire right now, after level, priority, and layer blocking are resolved. Use it to confirm a binding is live and to see which entry won a collision:

```ts
console.table(
  engine.registry.getAllActive().map((e) => ({
    keys: e.keys,
    description: e.description,
    level: e.level,
    priority: e.priority,
  })),
);
```

A shortcut you registered that is **absent** from this list is either blocked by an active exclusive layer (see [`<WhichKeyLayer>`](#whichkeylayer) — register it with `global: true` to punch through) or has lost its bucket to a higher-level or higher-priority entry.

### Console warnings

Every diagnostic which-key writes is prefixed `[whichkey]`. Nearly all of them are `console.warn` advisories — the library soft-fails on consumer misuse rather than throwing, so a warning means "this did not do what you meant", never "your app is about to crash". The one exception is the `console.error` in the last row: it fires when _your own_ shortcut handler throws, which is not consumer misuse of the which-key API, but which-key still catches it and keeps running rather than letting it propagate.

| Warning (abridged)                                                                                                                                                                                                                   | Meaning                                                                                                                                                                                                                             | Fix                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Shortcut "<keys>" has a same-level collision: "<winner>" (level <n>, priority <n>) wins over "<loser>" (level <n>, priority <n>). Raise the losing entry's priority or unregister one to resolve.`                                  | Two live entries at the same level are bound to the same key string.                                                                                                                                                                | Expected when using the layer pattern deliberately. Otherwise raise the loser's `priority` or unregister one.                                         |
| `<what> used outside <WhichKeyProvider>; wrap your app in <WhichKeyProvider> for it to work.`                                                                                                                                        | A hook (`useShortcut`, `useShortcutGroup`, `useWhichKeyState`) or a renderer component (`<WhichKeyPopup>`, `<ShortcutCheatsheet>`, `<WhichKeyLayer>`) rendered with no `<WhichKeyProvider>` ancestor.                               | Wrap your app in `<WhichKeyProvider>`.                                                                                                                |
| `invalid timeoutMs <value>; falling back to 500ms.`                                                                                                                                                                                  | `timeoutMs` passed to `createWhichKey` was not a non-negative finite number.                                                                                                                                                        | Pass a non-negative finite number, or omit the option.                                                                                                |
| `invalid helpKey "<helpKey>": <reason>; help shortcut disabled.`                                                                                                                                                                     | `helpKey` passed to `createWhichKey` could not be parsed as a key string.                                                                                                                                                           | Fix the key string, or pass `helpKey: null` to disable the built-in help shortcut deliberately.                                                       |
| `invalid helpKey ""; help shortcut disabled.`                                                                                                                                                                                        | `helpKey` was an empty string.                                                                                                                                                                                                      | Pass `helpKey: null` to disable help deliberately, or a valid key string.                                                                             |
| `handler for "<keys>" is not a function; shortcut not registered.`                                                                                                                                                                   | `register`'s second argument was not a function.                                                                                                                                                                                    | Pass a function.                                                                                                                                      |
| `invalid key string "<keys>": <reason>; shortcut not registered.`                                                                                                                                                                    | `register` could not parse the key string.                                                                                                                                                                                          | Fix the key string; see [Key-string syntax](#key-string-syntax).                                                                                      |
| `invalid group prefix "<prefix>": <reason>; group not registered.`                                                                                                                                                                   | `registerGroup` could not parse the prefix.                                                                                                                                                                                         | Fix the prefix.                                                                                                                                       |
| `invalid pushLayer level <value>; expected a non-negative integer. Falling back to <n>.`                                                                                                                                             | An explicit `level` passed to `pushLayer` was not a non-negative integer.                                                                                                                                                           | Omit `level` and let `pushLayer` allocate one.                                                                                                        |
| `invalid level <value> for "<keys>"; expected a non-negative integer. Falling back to 0.`                                                                                                                                            | `level` on `register`/`registerGroup` was negative, fractional, `NaN` or `Infinity`. The registration still happens, but at `level: 0` instead of the requested value.                                                              | Omit `level` and let `pushLayer` / `<WhichKeyLayer>` stamp it, or pass a non-negative integer.                                                        |
| `pushLayer level <n> undercuts the next free level (<n>); shortcuts on this layer may be blocked by an active exclusive layer.`                                                                                                      | An explicit `level` sits below the currently active layer stack.                                                                                                                                                                    | Usually a mistake — omit `level` and let `pushLayer` allocate one.                                                                                    |
| `mountWhichKey called twice for the same container; the previous mount is still active. Call unmount() on it first. This call is a no-op.`                                                                                           | A second renderer was mounted on a container that already has one.                                                                                                                                                                  | Call `unmount()` on the first mount, or mount into a different container.                                                                             |
| `invalid classPrefix "<prefix>"; must be a valid CSS identifier stem: letters, digits, "-" and "_", where the first character (or the character right after a leading "-") is a letter or "_", never a digit. Falling back to "wk".` | `classPrefix` passed to `mountWhichKey` is not a valid CSS identifier stem.                                                                                                                                                         | Use only letters, digits, `-` and `_`; the first character (or the character immediately after a leading `-`) must be a letter or `_`, never a digit. |
| `"<input>": Shift is dropped for punctuation and digits — write the shifted character directly (e.g. "?" not "Shift+/"). This binding will match "<base>".`                                                                          | A key string like `'Shift+/'` was registered. `Shift+` is silently dropped for punctuation/digit base characters, so the binding matches the _unshifted_ key, not the shifted glyph.                                                | Register the shifted character directly (e.g. `'?'` instead of `'Shift+/'`).                                                                          |
| `key string "<input>": "<base>" is not a key name this library recognises; if the browser does not report exactly this value, the binding will never match.`                                                                         | A multi-character base that is not a known special key or `F1`–`F12`.                                                                                                                                                               | Use the exact `event.key` spelling. Common aliases (`esc`, `up`, `pgup`, `f1`) are accepted case-insensitively.                                       |
| `Handler for "<keys>" threw; sequence state was reset.` (**`console.error`, not `console.warn`**)                                                                                                                                    | Your own shortcut handler for `<keys>` threw an exception. which-key caught it, logged it (the original error is passed as a second argument to `console.error`), and reset the pending sequence buffer so the engine stays usable. | Fix the exception in your handler; this is not a which-key bug.                                                                                       |

**Silent failures** — these produce no console output at all, so check them by hand:

- **A key string that canonicalizes differently than the runtime event** (see [`eventToCanonical`](#eventtocanonicalevent) above). Special-key base names (`Escape`, `Tab`, `ArrowUp`, `F1`, …) are accepted case-insensitively with the common aliases listed in [Key-string syntax](#key-string-syntax) (`'escape'`, `'esc'`, `'up'`, `'f1'`, …), so these now round-trip correctly. A base that isn't a recognised special key or alias still passes through verbatim, but now emits the `is not a key name this library recognises` warning above instead of failing silently — the only names that remain a silent risk are exotic multi-character `event.key` values that _are_ real (e.g. `'MediaPlayPause'`) but happen to be misspelled.
- **A binding shadowed by an active exclusive layer** (see [`engine.registry.getAllActive()`](#engineregistrygetallactive) above).
- **A shortcut suppressed because focus is in a text field** and it was registered without `enableOnInputs: true`.

---

## CSS class contract (`wk-*`)

The prebuilt stylesheet (`which-key/styles.css`) and the vanilla renderer both use this class set. Most classes carry the default theme's styling and can be overridden to customize appearance; a few (like `wk-popup-host`) are deliberately unstyled structural hooks the theme leaves alone.

| Class                         | Element                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `wk-popup`                    | Popup container                                                  |
| `wk-popup-host`               | Structural wrapper holding the popup; unstyled; **vanilla only** |
| `wk-popup--vertical`          | Modifier: corner popup (right-aligned, bottom)                   |
| `wk-popup--horizontal`        | Modifier: bottom bar spanning the viewport                       |
| `wk-popup__header`            | Header row (vertical layout)                                     |
| `wk-popup__body`              | Body wrapper (horizontal layout)                                 |
| `wk-popup__list`              | `<ul>` candidate list (vertical)                                 |
| `wk-popup__grid`              | CSS grid of candidates (horizontal)                              |
| `wk-row`                      | Single candidate entry                                           |
| `wk-row--group`               | Modifier: candidate is a group prefix                            |
| `wk-row__label`               | Candidate description text                                       |
| `wk-kbd`                      | `<kbd>` key chip                                                 |
| `wk-sequence`                 | Pressed-sequence display                                         |
| `wk-sequence__ellipsis`       | `…` appended to the pressed sequence                             |
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

When using a custom `classPrefix` (e.g. `'myapp'`), replace `wk-` with `myapp-` throughout. Note that setting `classPrefix` opts out of the shipped `which-key/styles.css` entirely — see [`mountWhichKey`'s `classPrefix` option](#mountwhichkey) under Vanilla for what that means and the warning emitted on an invalid value.
