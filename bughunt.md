# bughunt.md — code-health audit findings

Last triage: 2026-08-21 against `codehealth/2026-08-21` @ bfbb4cc. Toolchain: npm run build / npm test / npm run lint.

> **For future sessions reading this file:** when you fix an item listed
> here, strip it from this file in the same commit that fixes it. The list
> is intended to reflect open issues only; resolved items shouldn't linger.
> This keeps the file's signal-to-noise high for the next audit pass.

## How to use this file
- Check `[x] execute` on items to fix this batch.
- Check `[x] skip` on items to never re-flag (the skill records them in user memory).
- Items left unchecked stay in bughunt.md for the next run.
- Ranking is impact = severity × blast-radius (effort is shown separately, never folded into the rank).
- When ready, run `/code-health --execute`.

## Critical

## High

### B5. Every non-matching keystroke emits a new deep-equal snapshot, re-rendering all React subscribers: `onHidePopup` / `Matcher.resetBuffer` (src/engine/controller.ts:127)
- Category: caching
- Impact: 15 (severity 3 × blast-radius 5)
- Effort: S
- Risk: medium
- Evidence: `handleKeyDown`'s fall-through (matcher.ts:86) calls `resetBuffer()` for every key that matches nothing — i.e. essentially every key the user types anywhere in the host app. `resetBuffer` unconditionally calls `onHidePopup()`, which reassigns `snapshot = computeSnapshot()` (a fresh object) and notifies every listener even when `popupVisible` was already false and `currentSequence` already empty. Measured: 5 unrelated keystrokes on an idle engine → subscriber notified 5 times, snapshot identity changed, snapshots deep-equal. Because `useWhichKeyState` and `ShortcutCheatsheet` both use `useSyncExternalStore`, the new object identity fails `Object.is` and React re-renders `WhichKeyPopup` and `ShortcutCheatsheet` on **every keypress in the application**, including each character typed into a textarea; `mountWhichKey`'s `render()` re-runs too. docs/API.md:109 documents the listener as called "after every state change", so a no-op emit also violates the documented contract.
- Blast radius: src/engine/controller.ts:127; src/engine/matcher.ts:45,86,97; src/react/useWhichKeyState.ts:14; src/react/ShortcutCheatsheet.tsx:11; src/vanilla/mount.ts:52
- Proposed fix: guard the callback in controller.ts — `onHidePopup: () => { if (!popupVisible && currentSequence.length === 0) return; popupVisible = false; currentSequence = []; emit(); }`. State stays identical; only the redundant notification is suppressed.
- [x] execute   [ ] skip

### B6. handleKeyDown builds the full candidate list on every keystroke only to test emptiness, then the controller rebuilds it: `Matcher.handleKeyDown` / `getActiveCandidates` (src/engine/matcher.ts:38)
- Category: caching
- Impact: 15 (severity 3 × blast-radius 5)
- Effort: S
- Risk: medium
- Evidence: every keydown calls `registry.getActiveCandidates(prospectiveKeys)`, but the result is only ever consumed as `candidates.length === 0` / `> 0` (matcher.ts:40, 52, 69) — the array itself is discarded. `getActiveCandidates` (registry.ts:115-135) does a full scan of the `shortcuts` Map with `startsWith`, allocates a `seen` Map plus one object per match, calls `findActive` per matching bucket (each a full `layers` scan via `blockLevel`) and `getActiveGroup` per group candidate (another full scan). When the popup is already visible, matcher.ts:75 calls `onShowPopup`, whose `emit` runs `computeCandidates` and calls `getActiveCandidates` on the **same prefix a second time**, then copies and sorts it — two identical full-Map scans per keystroke for one event. On the common case (typing prose, buffer empty, nothing matches) the scan still runs in full and returns empty.
- Blast radius: src/engine/matcher.ts:38,40,52,69; src/engine/registry.ts:115; src/engine/controller.ts:94
- Proposed fix: add `hasCandidates(prefix: string): boolean` to `ShortcutRegistry` that returns true on the first key where `keys.startsWith(prefix + ' ')` and `findActive(bucket)` is defined — no allocation, no group lookups, early exit. Replace the three `candidates.length` checks with it and drop the local binding, so the full list is built exactly once by `computeCandidates` and only when a popup is actually shown.
- [x] execute   [ ] skip

### B7. Leader popup uses `role="dialog"` for a non-interactive transient hint, so it is silent to screen readers: `VerticalCorner` / `HorizontalBar` / `renderPopup` (src/react/WhichKeyPopup.tsx:34)
- Category: frontend
- Impact: 15 (severity 3 × blast-radius 5)
- Effort: S
- Risk: medium
- Evidence: the popup is tagged `role="dialog" aria-label="Keyboard shortcuts"` at all three sites (WhichKeyPopup.tsx:34, :44, vanilla/popup.ts:46-47). It is a transient hint: no focusable children, focus is never moved into it, it traps nothing, and it is dismissed by sequence timing rather than any dialog convention. Per the ARIA APG a `dialog` requires focus to be placed inside on open; because focus never moves, screen readers announce nothing at all — so the candidate list, the entire point of the popup, is invisible to AT users while the bogus role pollutes the AT dialog list.
- Blast radius: src/react/WhichKeyPopup.tsx:34,44; src/vanilla/popup.ts:46,47
- Proposed fix: replace with `role="status" aria-live="polite" aria-atomic="true" aria-label="Keyboard shortcuts"` at all three sites — a three-line change, identical in both renderers. Fix B18 (vanilla rebuild churn) first or the live region will re-announce on every keystroke.
- [x] execute   [ ] skip

### B8. Duplicate-registration warning fires on the documented layer-override pattern and misstates which entry wins: `ShortcutRegistry.register` (src/engine/registry.ts:36)
- Category: observability
- Impact: 12 (severity 3 × blast-radius 4)
- Effort: M
- Risk: medium
- Evidence: the warn fires on the single condition `bucket.length > 0`, regardless of level, priority, `enabled`, or exclusivity — which is precisely the mechanism README.md:125-215 documents for layers. Running the README's own modal example (page `register('Escape', …, {description:'page escape'})`, then `pushLayer({exclusive:true})`, then `layer.register('Escape', …)`) prints `Existing top: "(no description)"` — both halves wrong: the level-0 entry is blocked by the exclusive layer so nothing is active, and its description is `page escape`, not `(no description)`. The claim `new registration takes precedence until unmount` is also false whenever the existing entry has higher priority or level; registry.test.ts:68-74 exercises exactly that case. Under React StrictMode the double-mounted effects warn twice per mount. Net effect: developers learn `[whichkey]` means nothing and mute it — exactly when a genuine collision would go unnoticed. **Contractual test change:** registry.test.ts:77-85 asserts the current substring and description, and :87-90 asserts no warn on first registration.
- Blast radius: src/engine/registry.ts:35,36,37,38,39,140; src/engine/controller.ts:135,165; src/engine/__tests__/registry.test.ts:77,87; README.md:125,191
- Proposed fix: guard on the actual active entry rather than bucket length — insert first, then call `findActive(bucket)` and warn only when the new entry is not the winner **and** the pre-existing winner is at the same `level` (a true accidental collision, not a layer override). Rewrite the message to state the real outcome with both levels/priorities and the offending key. Skip entirely when levels differ or `findActive` returns undefined.
- [x] execute   [ ] skip

### B9. Leader-key popup renders keystrokes typed into password and text inputs: `Matcher.handleKeyDown` (src/engine/matcher.ts:69)
- Category: security
- Impact: 12 (severity 3 × blast-radius 4)
- Effort: S
- Risk: high
- Evidence: the prefix-only branch (matcher.ts:69-83) commits the pressed key into the buffer and schedules `onShowPopup` with **no** `isInputTarget(event.target)` guard, unlike the two leaf branches at lines 43 and 58. The listener is on `document`, so keys typed into any focused field reach the matcher. Confirmed: with `register('g h', …, {enableOnInputs:false})` — the README quick-start binding, which even renders a `<textarea>` beside it — typing `g` into a text field and pausing `timeoutMs` yields `popup visible = true, seq = ["g"]`. With a `<input type="password">` and a deeper registration such as `g a b c`, up to three consecutive typed password characters are rendered as `<kbd>` text in a `position:fixed; z-index:50` overlay and stay in the DOM until the buffer resets. docs/API.md:78 documents `enableOnInputs:false` as "the shortcut is suppressed while focus is in a text input" — the suppression is incomplete, and the user sees an overlay for a shortcut guaranteed not to fire.
- Blast radius: src/engine/matcher.ts:43,58,69,75,79; src/engine/controller.ts:118; src/react/WhichKeyPopup.tsx:18,35,46; src/vanilla/popup.ts:28,52,64
- Proposed fix: capture `const inInput = isInputTarget(event.target)` at the top of `handleKeyDown` and wrap the popup show/refresh block (matcher.ts:73-81) in `if (!inInput) { ... }`. Leave `commitBuffer` on line 71 unchanged so a deeper leaf with `enableOnInputs: true` can still complete and fire — only the visual rendering of buffered keys is gated.
- [x] execute   [ ] skip

### B10. Input guard bypassed for shadow-DOM fields because `event.target` is retargeted to the host: `Matcher.handleKeyDown` (src/engine/matcher.ts:43)
- Category: security
- Impact: 12 (severity 4 × blast-radius 3)
- Effort: S
- Risk: high
- Evidence: both input guards use the raw `event.target` (matcher.ts:43 and the captured `fireTarget` at :56), and `isInputTarget` (keys.ts:125-136) only accepts INPUT/TEXTAREA/contenteditable. Per the DOM spec an event crossing an open shadow boundary is retargeted, so a listener on `document` sees `event.target` as the shadow **host**, not the inner `<input>`. For any web-component field — Lit/Shoelace/Ionic/LWC login forms wrapping `<input type="password">` in a shadow root — `isInputTarget` returns false and the shortcut fires. Concrete path: an app registers a single-letter destructive shortcut (`d` = delete, `x` = archive) with the default `enableOnInputs:false`; the user types a password containing `d` into a shadow-DOM field and the handler runs. No test constructs a shadow root, and matcher.ts:58-61 is entirely uncovered.
- Blast radius: src/engine/matcher.ts:43,56,58; src/engine/keys.ts:125; src/engine/index.ts:2; src/engine/controller.ts:148,207
- Proposed fix: resolve the true origin at the two call sites without touching the publicly-exported `isInputTarget` signature — add `const eventTarget = typeof event.composedPath === 'function' ? (event.composedPath()[0] ?? event.target) : event.target;` at the top of `handleKeyDown`, then use it at line 43 and for `fireTarget` at line 56. `composedPath()[0]` is the un-retargeted origin for open shadow roots and equals `event.target` otherwise, so non-shadow behavior is byte-identical.
- [x] execute   [ ] skip

### B11. parseKey rejects lowercase modifiers although both README and API.md promise case-insensitivity: `parseKey` / `KNOWN_MODIFIERS` (src/engine/keys.ts:65)
- Category: correctness
- Impact: 12 (severity 4 × blast-radius 3)
- Effort: S
- Risk: medium
- Evidence: empirically confirmed — `parseKey('ctrl+s')`, `'CTRL+s'`, `'shift+a'`, `'alt+x'`, `'cmd+k'`, `'mod+k'` all throw `whichkey: unknown modifier "..."`; only exact `Ctrl`/`Alt`/`Shift`/`Cmd`/`Mod` are accepted, because `KNOWN_MODIFIERS` is a case-sensitive `Set` and the switch matches exact strings. README.md:85 states "Modifiers are case-insensitive and can be combined" and docs/API.md:351 repeats "Modifier names are case-insensitive." The throw is not a soft failure: it propagates out of `engine.register` / `useShortcut`'s effect (useShortcut.ts:22) and out of `createWhichKey` when `helpKey` is e.g. `'ctrl+/'`, tearing down the consumer's React tree at the nearest error boundary. keys.ts:90-91 and 96-97 (the Alt and Cmd switch arms) are uncovered.
- Blast radius: src/engine/keys.ts:65,73,82,85; src/engine/controller.ts:136; src/react/useShortcut.ts:22; README.md:85; docs/API.md:351
- Proposed fix: normalize before lookup — `const MODIFIER_ALIASES = new Map([['ctrl','Ctrl'],['control','Ctrl'],['alt','Alt'],['option','Alt'],['shift','Shift'],['cmd','Cmd'],['meta','Cmd'],['command','Cmd'],['mod','Mod']])`, then `const mod = MODIFIER_ALIASES.get(seg.toLowerCase()); if (!mod) throw ...`. Apply the same lowercase lookup to the bare-modifier check at keys.ts:73. Strictly widens accepted input; keys.test.ts:155 (`parseKey('Hyper+K')` throws) still passes.
- [x] execute   [ ] skip

### B12. Package `exports` never points at the emitted `.d.cts` files, breaking types for node16 CJS consumers: `exports` (package.json:32)
- Category: api-surface
- Impact: 12 (severity 4 × blast-radius 3)
- Effort: S
- Risk: medium
- Evidence: each subpath uses a flat `{ types, import, require }` object, so a single ESM-flavoured `types: "./dist/*/index.d.ts"` serves both conditions (the package is `"type": "module"`). tsup **does** emit `dist/engine/index.d.cts`, `dist/react/index.d.cts`, `dist/vanilla/index.d.cts` — confirmed present in `npm pack --dry-run` — but nothing in `exports` references them, so they ship as dead weight. A consumer compiling with `moduleResolution: "node16"`/`"nodenext"` from a CJS file doing `require('which-key')` resolves the `require` runtime target but the ESM `.d.ts` for types, which TS rejects on the declaration-format mismatch. Bundler-resolution consumers are unaffected, which is why it is invisible in-repo.
- Blast radius: package.json:32,34,39,44
- Proposed fix: nest conditions per-format with `types` first inside each branch — `".": { "import": { "types": "./dist/engine/index.d.ts", "default": "./dist/engine/index.js" }, "require": { "types": "./dist/engine/index.d.cts", "default": "./dist/engine/index.cjs" } }` — and likewise for `./react` and `./vanilla`. The files already exist; no build change needed.
- [x] execute   [ ] skip

### B13. Documented CSS class contract omits 11 emitted classes and mislabels `wk-cheatsheet` as the backdrop: CSS class contract table (README.md:241)
- Category: frontend
- Impact: 12 (severity 3 × blast-radius 4)
- Effort: S
- Risk: high
- Evidence: both renderers emit 23 distinct classes; the README table (226-241) and the API table (docs/API.md:370-384) each list only 14. Missing from both: `wk-backdrop`, `wk-cheatsheet__title`, `wk-cheatsheet__sections`, `wk-cheatsheet__section`, `wk-cheatsheet__list`, `wk-cheatsheet__list--nested`, `wk-cheatsheet__item`, `wk-cheatsheet__group-title`, `wk-cheatsheet__group-label`, `wk-cheatsheet__hint`. Worse, the one cheatsheet row present is actively wrong: `wk-cheatsheet` is described as "Cheatsheet backdrop/container", but it is the inner scrollable panel — the full-screen overlay is the undocumented `wk-backdrop`. A consumer told to "bring your own by targeting the `wk-*` CSS class contract" (README.md:224) styles the panel as if it were the overlay and gets no dimming, no centering, no fixed positioning. `examples/vanilla/index.html:46-58` is a live demonstration of exactly this failure inside this repo.
- Blast radius: README.md:241; docs/API.md:384; src/react/ShortcutCheatsheet.tsx:29; src/vanilla/cheatsheet.ts:26; src/styles.css:39; examples/vanilla/index.html:46
- Proposed fix: add the 10 missing cheatsheet classes plus `wk-backdrop` to both tables, correct the `wk-cheatsheet` row to "Cheatsheet panel (scrollable content box)", and add a `wk-backdrop` row for "Full-screen dimmed overlay behind the cheatsheet". Docs-only.
- [x] execute   [ ] skip

> **decision-needed (behavioral):** the cheatsheet overlay is not modal — `toggleCheatsheet`/`openCheatsheet` only flip `cheatsheetVisible` and `Matcher.handleKeyDown` never consults it, so while the full-screen sheet covers the app, pressing `s` still fires the page's Save shortcut and `g` pops the leader popup over the backdrop. Additionally both Escape-to-close listeners (src/react/ShortcutCheatsheet.tsx:20, src/vanilla/mount.ts:27) are on `document` and neither `preventDefault`s nor `stopPropagation`s, so with the README's own layer example (`useShortcut('Escape', onClose)`, README.md:167) one Escape press closes the cheatsheet **and** the user's modal (confirmed empirically). Impact 12 (severity 3 × blast-radius 4). The correct fix — making the cheatsheet an engine-level exclusive layer and routing its Escape through a real global shortcut — changes dispatch semantics for anyone relying on shortcuts working behind the cheatsheet, and touches both renderers. Discuss scope before scheduling.

## Medium

### B14. useShortcut with a bad key string throws inside an effect and takes down the consumer's tree: `useShortcut` (src/react/useShortcut.ts:22)
- Category: api-surface
- Impact: 9 (severity 3 × blast-radius 3)
- Effort: S
- Risk: medium
- Evidence: `engine.register(keys, …)` is called from inside `useEffect`; `register` runs `parseSequence(keys)` which throws for empty/whitespace-only strings, unknown modifiers (`'ctrl+s'` — the case README.md:85 says is legal, see B11), and dangling `+`. A throw from a passive effect is not recoverable by the hook and propagates to the nearest error boundary, unmounting the consumer's subtree. docs/API.md:227-236 documents `useShortcut` with no mention that it can throw, and the surrounding code deliberately soft-fails the *other* misuse (missing provider → `console.warn` at useShortcut.ts:19), so the failure modes are inconsistent. Same exposure via `LayerHandle.register`. Separately, `register` does no `typeof handler === 'function'` check, so a non-function handler is accepted and only blows up much later inside `matcher.handleKeyDown`.
- Blast radius: src/react/useShortcut.ts:22; src/engine/controller.ts:152,156,196; src/engine/matcher.ts:47; docs/API.md:227
- Proposed fix: validate up front in `createWhichKey.register` — if `typeof h !== 'function'`, warn and return a no-op unregister; wrap `parseSequence` in try/catch, `console.warn('[whichkey] invalid key string "<keys>": <msg>; shortcut not registered')` and return a no-op unregister. Purely internal, return type unchanged. Document the soft-failure in docs/API.md:57.
- [ ] execute   [ ] skip

### B15. Lowercase or aliased special-key names register silently dead bindings: `parseKey` (src/engine/keys.ts:105)
- Category: correctness
- Impact: 9 (severity 3 × blast-radius 3)
- Effort: M
- Risk: medium
- Evidence: empirically confirmed. `parseKey` passes any multi-character base through verbatim, so `register('escape')`, `'tab'`, `'enter'`, `'space'`, `'up'`, `'esc'`, `'backspace'`, `'f1'` all succeed and produce canonical strings no KeyboardEvent can ever produce. Firing every corresponding real key gave `{"escape":0,"tab":0,"enter":0,"space":0,"up":0,"ArrowUp":1,"Escape":1,"esc":0,"f1":0,"F1":1}` — only exactly-cased names fire. Because `parseKey` happily throws on an unknown *modifier*, a consumer reasonably assumes bad key strings are validated; this failure is completely silent. No test covers an unrecognized base.
- Blast radius: src/engine/keys.ts:3,105,112; src/engine/controller.ts:136,156; src/react/useShortcut.ts:22
- Proposed fix: add a case-insensitive alias table for known special bases (SPECIAL_KEYS plus `Space` and `F1`-`F12`, with `esc`→`Escape`, `up`/`down`/`left`/`right`→`Arrow*`, `pgup`/`pgdn`→`PageUp`/`PageDown`) and normalize `base` through it before `buildCanonical`. For a multi-character base not in the table and not `F1`-`F12`, `console.warn` that the key string will never match — do not throw, since exotic `event.key` values should stay bindable.
- [ ] execute   [ ] skip

### B16. docs/API.md omits the entire layers API it claims to fully document: `WhichKeyEngine` (docs/API.md:53)
- Category: api-surface
- Impact: 9 (severity 3 × blast-radius 3)
- Effort: M
- Risk: low
- Evidence: README.md:254 calls docs/API.md "the full reference". The `WhichKeyEngine` section (53-144) documents register/registerGroup/start/stop/subscribe/getSnapshot/cheatsheet methods/cancel/registry — but not `pushLayer` or `activateLayer`. The React section (194-287) and its table of contents omit `<WhichKeyLayer>` and `WhichKeyLayerProps` entirely, though both are exported from src/react/index.ts:4-5. Further drift in the same file: the `ShortcutOptions` table (73-80) omits the real `global` and `level` options (types.ts:10-11); the `registerGroup` options table (90-95) omits `level`; and the `popup` default is listed as `{}` (322) when the real defaults are `{layout:'vertical', maxRows:5, backgroundOpacity:0.95}`. A consumer reading only the reference cannot discover layers at all.
- Blast radius: docs/API.md:15,53,73,90,194,322; src/engine/controller.ts:37; src/react/WhichKeyLayer.tsx:9
- Proposed fix: add `engine.pushLayer(options?)` and `engine.activateLayer(level, exclusive)` sections plus a `LayerHandle` type block to the engine section; add a `<WhichKeyLayer>` section and TOC entry to the React section; add `global`/`level` rows to the ShortcutOptions table, `level` to the registerGroup table, and correct the `popup` default. Docs-only.
- [ ] execute   [ ] skip

### B17. Leaf-AND-prefix timeout hands the handler a synthetic event with null target, no modifier flags, and an inert preventDefault: `Matcher.handleKeyDown` (src/engine/matcher.ts:62)
- Category: correctness
- Impact: 8 (severity 4 × blast-radius 2)
- Effort: S
- Risk: high
- Evidence: empirically confirmed. `new KeyboardEvent('keydown', { key })` is never dispatched, so `cancelable` defaults to false and `target` is null. Running the timeout path yields `target=null ctrl=false shift=false cancelable=false` and `defaultPrevented after preventDefault(): false`, while the pure-leaf path on the same engine gives `target=real cancelable=true defaultPrevented=true`. So an identical handler behaves differently depending on whether the shortcut happened to also be a prefix and whether the user waited out the timeout: `preventDefault()` silently no-ops, `event.target` is null (crashing any handler doing `event.target.closest(...)`), and Ctrl/Shift/Alt/Meta all read false even though they were held. The original event is already in scope (`fireTarget = event.target`, matcher.ts:56). matcher.ts:59-61 is uncovered and matcher.test.ts only asserts `expect.any(KeyboardEvent)`.
- Blast radius: src/engine/matcher.ts:56,62; src/engine/controller.ts:117; src/engine/__tests__/matcher.test.ts:196
- Proposed fix: capture the triggering event (`const fireEvent = event;`) alongside `fireTarget` and pass it to `onFire` instead of synthesizing — replace lines 62-63 with `this.options.onFire(leaf, fireEvent);` and drop the `new KeyboardEvent(...)`. Modifier flags, key and target are then accurate.
- [ ] execute   [ ] skip

### B18. Vanilla `render()` destroys and rebuilds the popup subtree on every emit, stacking it above the cheatsheet backdrop unlike React: `mountWhichKey.render` (src/vanilla/mount.ts:32)
- Category: frontend
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: M
- Risk: high
- Evidence: `render()` unconditionally does `popupNode?.remove(); popupNode = null;` then re-`appendChild`s a freshly built node on every engine emit (which today is every keystroke — see B5), while the cheatsheet backdrop is appended once on open and left in place. Since `.wk-popup` and `.wk-backdrop` share `z-index: 50` (styles.css:16, :40), painting order falls to DOM order: once the cheatsheet is open, the next popup render lands *after* the backdrop, so the popup paints on top of the full-screen overlay. React reconciles in place and honours the README's JSX order, so there the backdrop correctly covers the popup — a renderer divergence. Reproduce: open the cheatsheet with `?`, then press a leader key. While the popup is open, each continuation keypress also discards the entire panel and allocates a fresh subtree (full detach/reattach, style recalc, visible flicker). mount.ts:32 and :59 are uncovered.
- Blast radius: src/vanilla/mount.ts:29,32,36,40,52; src/vanilla/popup.ts:38; src/styles.css:16,40; src/react/WhichKeyPopup.tsx:33
- Proposed fix: create a stable popup host element once at mount, append it once, and replace only its children each render (`host.replaceChildren(...)`), toggling `host.hidden` when the snapshot has no visible popup. Fixes both the stacking order and the churn in one change to mount.ts:31-37.
- [ ] execute   [ ] skip

### B19. blockLevel() rescans the entire layers Map once per bucket instead of once per query: `ShortcutRegistry.blockLevel` (src/engine/registry.ts:22)
- Category: caching
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: medium
- Evidence: `blockLevel()` iterates all active layers and is called from `findActive` (registry.ts:141) and `getActiveGroup` (:87), both invoked in loops. `getActiveCandidates` calls `findActive` per matching bucket and `getActiveGroup` per group candidate; `getAllActive` calls `findActive` for every bucket. So one `getAllActive` over N keys costs N full layer scans, and `buildCheatsheetModel` adds one more per group. The value is invariant for the whole call — it changes only on `activateLayer`/`deactivateLayer` — yet is recomputed O(N) times. Small in absolute terms, but it multiplies the per-keystroke work in B6.
- Blast radius: src/engine/registry.ts:9,13,22,87,106,115,141
- Proposed fix: add `private blockLevelCache: number | null = null`, return it from `blockLevel()` when non-null, and reset to null in `activateLayer` and `deactivateLayer` — the only two mutators of `layers`, so invalidation is exhaustive.
- [ ] execute   [ ] skip

### B20. getActiveCandidates dedup key collides between a leaf and a deeper sequence, dropping one and making isGroup order-dependent: `ShortcutRegistry.getActiveCandidates` (src/engine/registry.ts:127)
- Category: correctness
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: M
- Risk: medium
- Evidence: empirically confirmed. `candidateKey` is the full key string for a leaf but `prefix + ' ' + nextKey` for a deeper sequence — for a leaf `g h` and a deeper `g h i` both evaluate to `'g h'`, so the `seen` Map drops whichever arrives second, and **registration order decides the output**. Registering `['g h','g h i']` yields `[{keys:'g h', nextKey:'h', isGroup:false}]` — the whole `g h i` subtree is invisible in the popup and the row looks like a terminal action. Registering `['g h i','g h']` yields `[{keys:'g h', nextKey:'h', isGroup:true}]` — the leaf's own description is silently lost and `description` is undefined because no group was registered for `g h`. registry.test.ts covers leaf-only and group-only prefixes but never the mixed case.
- Blast radius: src/engine/registry.ts:122,127,128; src/engine/controller.ts:94; src/react/WhichKeyPopup.tsx:37; src/vanilla/popup.ts:56
- Proposed fix: key `seen` by `nextKey` only and merge rather than skip — on a collision promote the entry to `isGroup: true` (a deeper continuation exists) and keep `description = this.getActiveGroup(subPrefix)?.description ?? existing.description ?? top.description` so the leaf's label survives when no group label is registered.
- [ ] execute   [ ] skip

### B21. Popup shows a stale sequence and stale candidates during the leaf-AND-prefix wait: `Matcher.handleKeyDown` (src/engine/matcher.ts:54)
- Category: correctness
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: empirically confirmed. The leaf-AND-prefix branch (matcher.ts:52-67) commits the new buffer but never calls `onShowPopup`, while the prefix-only branch (:73-75) does refresh when the popup is already visible. With `g h` (leaf) + `g h x` + `g p` registered and `timeoutMs=50`: after `g` + timeout the snapshot is `visible=true seq=["g"] cands=["h","p"]`; immediately after pressing `h` it is *still* `seq=["g"] cands=["h","p"]` even though the buffer is now `[g,h]` and the only real continuation is `x`. The user sees the wrong prompt for the whole timeout window, and `p` is advertised as pressable when it will abort the sequence. This is the observable half of the `Matcher.popupVisible` / controller `popupVisible` split.
- Blast radius: src/engine/matcher.ts:52,73; src/engine/controller.ts:118; src/react/WhichKeyPopup.tsx:35; src/vanilla/popup.ts:51
- Proposed fix: mirror the prefix-only branch — after `this.commitBuffer(prospective); this.clearTimer();` add `if (this.popupVisible) this.options.onShowPopup({ currentSequence: [...this.buffer] });`.
- [ ] execute   [ ] skip

### B22. registerGroup never canonicalizes its prefix, so group labels silently vanish: `WhichKeyEngine.registerGroup` (src/engine/controller.ts:168)
- Category: api-surface
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: `register` runs `parseSequence(keys)` (controller.ts:156) but `registerGroup` passes `prefix` straight through untouched (:170), so the two key into different namespaces whenever the raw string differs from its canonical form. Verified against the built bundle: `registerGroup('Shift+a', {description:'Shifted group'})` + `register('Shift+a b', …)` leaves the shortcut under `'A b'` while the group sits under `'Shift+a'`; `getActiveGroup('A')` returns undefined and the popup shows a bare key with no label. Also asymmetric on empty input: `register('')` throws, `registerGroup('')` is accepted silently. Same asymmetry in `useShortcutGroup`.
- Blast radius: src/engine/controller.ts:168,170; src/engine/registry.ts:60,84; src/react/useShortcutGroup.ts:15; docs/API.md:82
- Proposed fix: canonicalize before storing — `registry.registerGroup({ id, prefix: parseSequence(prefix).join(' '), … })`. This also makes `registerGroup` reject empty/whitespace prefixes the same way `register` does. Behaviour-compatible for every prefix already in canonical form.
- [ ] execute   [ ] skip

### B23. An invalid helpKey makes createWhichKey (and WhichKeyProvider's render) throw, undocumented: `createWhichKey` (src/engine/controller.ts:137)
- Category: api-surface
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: `parseKey(helpKey)` runs unguarded in the constructor and throws plain `Error`s for an empty string, a trailing `+`, or an unknown modifier. Neither docs/API.md:40-49 nor README.md:107-113 (which shows `createWhichKey({ helpKey: 'F1' })`) mentions that `helpKey` can throw. Worse in React: `WhichKeyProvider` calls `createWhichKey` in its render body, so `<WhichKeyProvider helpKey="ctrl/">` throws during render and unmounts the consumer's entire tree with no error boundary in between. `useShortcut`'s missing-provider path degrades to a `console.warn`, so the surrounding API sets an expectation of soft failure that this path violates.
- Blast radius: src/engine/controller.ts:134,137; src/react/WhichKeyProvider.tsx:17; docs/API.md:45; README.md:110
- Proposed fix: wrap the helpKey registration in try/catch — on parse failure emit `console.warn('[whichkey] invalid helpKey "…": <message>; help shortcut disabled')` and skip registration, matching the soft-failure convention already used in useShortcut.ts:19. Add a "Throws" note to the `helpKey` row in docs/API.md:45.
- [ ] execute   [ ] skip

### B24. Renderer components silently render nothing outside a provider while the three hooks warn: `useWhichKeyState` / `ShortcutCheatsheet` (src/react/useWhichKeyState.ts:15)
- Category: observability
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: high
- Evidence: `useShortcut`, `useShortcutGroup` and `<WhichKeyLayer>` all emit a consistent `[whichkey] … outside <WhichKeyProvider>` warn. The three consumers that actually put pixels on screen do not: `useWhichKeyState` falls back to `noopSubscribe`/`getEmptySnapshot` and returns a no-op `cancel` in silence, `<ShortcutCheatsheet>` falls back and returns null, and `<WhichKeyPopup>` inherits the silence via `useWhichKeyState`. This is the highest-frequency integration mistake — placing `<WhichKeyPopup />` outside the provider — and it presents as "the popup never appears" *with the shortcuts still firing*, so the developer suspects CSS, z-index or the styles.css import, not the provider. All three fallback paths are uncovered (useWhichKeyState.ts 15-16, 23; ShortcutCheatsheet.tsx 12-16). The existing three warns are also ungated and undeduped, re-firing on every effect dep change.
- Blast radius: src/react/useWhichKeyState.ts:15,23; src/react/ShortcutCheatsheet.tsx:11,25; src/react/WhichKeyPopup.tsx:2; src/react/useShortcut.ts:19; src/react/useShortcutGroup.ts:12; src/react/WhichKeyLayer.tsx:15
- Proposed fix: extract a shared `warnNoProvider(what: string)` helper in src/react/context.ts that dedupes via a module-level `Set<string>`, and call it from all four sites (naming `<WhichKeyPopup>` / `<ShortcutCheatsheet>` in their messages) so the diagnostics are uniform. Fire it from a `useEffect` so it warns once per mount.
- [ ] execute   [ ] skip

### B25. PopupOptions is documented as a public type but is not exported from which-key/vanilla: `PopupOptions` (src/vanilla/index.ts:2)
- Category: api-surface
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: docs/API.md:322 types the `popup` option as `Partial<PopupOptions> | false` and :327 gives `PopupOptions` its own table, but src/vanilla/index.ts only re-exports `mountWhichKey` and `MountOptions`. Confirmed in the shipped declarations: `dist/vanilla/index.d.ts` *declares* `type PopupOptions` (it must, since `MountOptions` references it) but the terminal export list leaves it unnamed. A consumer writing `function popupCfg(): Partial<PopupOptions>` cannot import the type and must retype it by hand. Same gap: `mountWhichKey`'s return is an inline anonymous `{ unmount(): void }` with no exported alias, so a consumer cannot annotate the handle they hold.
- Blast radius: src/vanilla/index.ts:2; src/vanilla/popup.ts:3; src/vanilla/mount.ts:6,14; docs/API.md:322,327
- Proposed fix: add `export type { PopupOptions } from './popup';` to src/vanilla/index.ts and export a named `WhichKeyMountHandle = { unmount(): void }` from mount.ts, using it as `mountWhichKey`'s declared return type. Both additive — existing structural usage keeps compiling.
- [ ] execute   [ ] skip

### B26. Hardcoded `z-index: 50` with no override hook puts the overlay under most host-app modal layers: `styles.css` (src/styles.css:16)
- Category: frontend
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: high
- Evidence: `.wk-popup` (:16) and `.wk-backdrop` (:40) both use a literal `z-index: 50`. This library renders *over* someone else's app, but 50 is below the stacking layer every major UI kit uses for modals (Bootstrap `.modal` 1055, MUI modal 1300, Ant Design 1000). A consumer who presses `?` while any such dialog is open gets the cheatsheet rendered behind it and unreachable. Because both which-key layers use the identical value, DOM order alone decides popup-vs-backdrop ordering, which is what makes the B18 divergence observable. There is no CSS custom property, so overriding requires out-specifying two selectors from the shipped sheet.
- Blast radius: src/styles.css:16,40; README.md:218; examples/vanilla/index.html:30
- Proposed fix: replace both literals with `z-index: var(--wk-z-index, 1000);` and `z-index: var(--wk-z-index-backdrop, var(--wk-z-index, 1000));`, and document the two variables in the README Styling section.
- [ ] execute   [ ] skip

### B27. eslint config lacks jsx-a11y and react-hooks plugins for a package whose product is shipped UI: `eslint.config.js` (eslint.config.js:5)
- Category: frontend
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: the whole config is `tseslint.configs.recommended` with `examples` ignored. For a library that ships JSX overlays into third-party apps there is no `eslint-plugin-jsx-a11y` — which would have flagged the backdrop's `onClick` on a plain `<div>` (ShortcutCheatsheet.tsx:29) under `no-static-element-interactions`/`click-events-have-key-events`, and the bare `role="dialog"` sites — and no `eslint-plugin-react-hooks`, so there is no `exhaustive-deps` checking over the six hook call sites in src/react/. `npm run lint` is green, which is why the a11y gaps in B3 and B7 shipped in v0.1.1.
- Blast radius: eslint.config.js:5; package.json:78; src/react/ShortcutCheatsheet.tsx:29; src/react/WhichKeyPopup.tsx:34; src/react/useShortcut.ts:17
- Proposed fix: add `eslint-plugin-jsx-a11y` and `eslint-plugin-react-hooks` as devDependencies and append their recommended flat configs scoped to `src/react/**/*.tsx`. Expect B3 and B7 to light up — fix or schedule those first, or the lint gate will fail.
- [ ] execute   [ ] skip

### B28. The debugging exports that answer "why doesn't my shortcut fire" are undocumented: `parseKey` / `eventToCanonical` / `registry` (docs/API.md:142)
- Category: observability
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: the three things that silently kill a shortcut — canonicalization mismatch (B2, B15), an exclusive layer raising `blockLevel`, and a higher-level entry winning `findActive` — are all unobservable from the public API. docs/API.md:142-144 documents `engine.registry` as nothing more than "Read-only reference to the underlying ShortcutRegistry. Advanced use only." with no members listed, so a developer cannot tell whether `getAllActive()` is supported or internal. Meanwhile `parseKey` and `eventToCanonical` **are** already exported from src/engine/index.ts:2 and re-exported through `which-key/react` — and are exactly the tool needed to diagnose B2, since `parseKey('Shift+/')` immediately reveals the `/` mismatch — but neither appears anywhere in docs/API.md or README.md, so nobody knows they exist.
- Blast radius: docs/API.md:142,337; src/engine/index.ts:2; src/react/index.ts:13; src/engine/registry.ts:22,78,140
- Proposed fix: document the already-exported `parseKey(keys)` / `parseSequence(keys)` / `eventToCanonical(event)` in docs/API.md under a short "Debugging" heading with the canonical-form-inspection recipe, and document `registry.getAllActive()` as the supported way to list live bindings. Zero-risk, docs-only. (A richer `registry.explain(keys)` returning why a binding is unreachable is a new public method — out of scope here.)
- [ ] execute   [ ] skip

> **decision-needed (API):** library warnings are unconditional, unsilenceable, and shipped verbatim into consumers' production bundles. There are four `console.warn` sites (src/engine/registry.ts:39, src/react/useShortcut.ts:19, src/react/useShortcutGroup.ts:12, src/react/WhichKeyLayer.tsx:15) and no way to suppress or route any of them — `WhichKeyOptions` has no `onWarn`/`silent` field and `ShortcutRegistry` takes no constructor options. `grep -rn 'NODE_ENV|process.env|import.meta.env' src tsup.config.ts` returns nothing and tsup has no `define`, so the strings ship in every bundle and cannot be dead-code-eliminated. Combined with B8, a production app that mounts one modal layer writes to the end user's console on every mount. Impact 10 (severity 2 × blast-radius 5). The fix adds a public `onWarn` option to `WhichKeyOptions` and `<WhichKeyProvider>` — a public-API addition that should be decided deliberately, not auto-applied.

> **decision-needed (behavioral):** the React renderer does not portal, so `position: fixed` overlays break inside any transformed ancestor. `.wk-popup` and `.wk-backdrop` are `position: fixed` but neither component uses `createPortal`; per CSS spec a `transform`/`filter`/`perspective`/`contain: paint`/`will-change` on any ancestor becomes the containing block for fixed descendants. Any consumer placing `<WhichKeyPopup/>` inside an animated or transformed shell (page-transition wrappers, `translateZ(0)` GPU hints, framer-motion layouts) gets the popup pinned to that box instead of the viewport and the cheatsheet backdrop clipped to it. Impact 9 (severity 3 × blast-radius 3). Portalling to `document.body` changes where nodes land in consumers' DOM and test queries, so confirm before applying.

## Low

### B29. clamp01 and clampRows pass NaN straight through, emitting invalid CSS in both renderers: `clamp01` / `clampRows` (src/react/WhichKeyPopup.tsx:12)
- Category: api-surface
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: `clamp01 = n => Math.min(1, Math.max(0, n))` and `clampRows = n => Math.max(1, Math.floor(n))` are both identity for NaN (`Math.max(0, NaN) === NaN`). The pair is duplicated verbatim in src/vanilla/popup.ts:5-6, so both renderers share the hole. A consumer computing the value from config or user input (`backgroundOpacity={Number(cfg.opacity)}`) gets `rgba(17, 24, 39, NaN)`, which the CSSOM rejects — so `backgroundColor` is never set and the popup renders with no background at all, leaving `#f3f4f6` text on the bare host page: invisible on any light background. `maxRows={NaN}` similarly yields `repeat(NaN, auto)` and the horizontal grid collapses. These helpers exist purely to be defensive and are not. Existing tests cover 0, 1, 0.5, 0.7 and negative/overflow rows but never NaN.
- Blast radius: src/react/WhichKeyPopup.tsx:12,13,59,62; src/vanilla/popup.ts:5,6,40,55; src/vanilla/mount.ts:20,21
- Proposed fix: make both total — `Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.95` and `Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 5`. Better still, hoist the pair into a shared internal module so the two copies cannot drift again.
- [ ] execute   [ ] skip

### B30. timeoutMs is unvalidated, so NaN/negative values silently make the popup instantaneous: `WhichKeyOptions.timeoutMs` (src/engine/controller.ts:81)
- Category: api-surface
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: high
- Evidence: `timeoutMs` is destructured with a 500 default and handed straight to the Matcher, which passes it to `setTimeout`. `setTimeout` coerces NaN, negative and overflow values to 0, so `createWhichKey({ timeoutMs: -1 })` — or a value computed from bad config — produces a popup that flashes open on the first keystroke and a leaf-and-prefix shortcut that fires with zero grace period, the exact opposite of the documented "Milliseconds of inactivity before a partial sequence is cancelled" (docs/API.md:44). No error, no warning. Same path from React via `<WhichKeyProvider timeoutMs={…}>`. Nothing in the suite exercises a non-positive or NaN timeout.
- Blast radius: src/engine/controller.ts:81,116; src/engine/matcher.ts:65,80; src/react/WhichKeyProvider.tsx:17; docs/API.md:44
- Proposed fix: clamp at the boundary — `const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs >= 0 ? options.timeoutMs : 500;` with a `console.warn` when a supplied value is rejected. Purely internal; the `timeoutMs?: number` signature is unchanged.
- [ ] execute   [ ] skip

### B31. isMacPlatform reads deprecated `navigator.platform` unguarded, so `Mod+` throws where navigator is absent: `isMacPlatform` (src/engine/keys.ts:20)
- Category: correctness
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: `/Mac|iPod|iPhone|iPad/.test(navigator.platform)` dereferences the `navigator` global with no guard, and is reached from `parseKey` for every `Mod+` binding — the form README.md:203,211 presents as the recommended cross-platform spelling. Node only gained a global `navigator` in v21 while package.json declares `engines.node >= 20`, so on a supported Node 20 SSR/prerender/test runtime `register('Mod+/')` throws `ReferenceError: navigator is not defined`. `navigator.platform` is also deprecated and frozen by anti-fingerprinting modes. The two `Mod` tests stub `navigator.platform` via `defineProperty`, so the absent-navigator path is untested.
- Blast radius: src/engine/keys.ts:20,99; README.md:83,203; docs/API.md:349; src/engine/__tests__/keys.test.ts:140
- Proposed fix: `if (typeof navigator === 'undefined') return false;` then prefer `navigator.userAgentData?.platform ?? navigator.platform ?? ''`. Keeps both existing Mod tests passing.
- [ ] execute   [ ] skip

### B32. mountWhichKey has no double-mount guard, so two calls silently duplicate the popup DOM: `mountWhichKey` (src/vanilla/mount.ts:12)
- Category: api-surface
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: high
- Evidence: nothing tracks whether an engine or container already has a renderer attached. Calling `mountWhichKey(wk)` twice — a hot-reload re-run, a component that mounts on route change without unmounting, two modules wiring the same engine — yields two subscriptions and two nodes appended to `document.body`, both carrying `data-testid="whichkey-popup"` and `role="dialog" aria-label="Keyboard shortcuts"`. Two same-labelled dialogs is an a11y defect, the escape listener is registered twice, and the first `unmount()` leaves the second renderer live. mount.ts:32 and :59 are uncovered and mount.test.ts has no double-mount case.
- Blast radius: src/vanilla/mount.ts:12,15,52,56; src/vanilla/popup.ts:42,46
- Proposed fix: keep a module-level `WeakSet<HTMLElement>` of containers with a live mount; on a repeat mount `console.warn('[whichkey] mountWhichKey called twice for the same container; the previous mount is still active')`. Make `unmount()` idempotent by clearing the entry. Return type unchanged.
- [ ] execute   [ ] skip

### B33. classPrefix silently opts the consumer out of the shipped stylesheet, undocumented: `mountWhichKey` (src/vanilla/mount.ts:18)
- Category: frontend
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: `classPrefix` threads correctly through every vanilla class (verified: all 23 class writes use the `${p}-` template, none hardcoded), but src/styles.css hardcodes `.wk-*` in all 24 selectors. So `mountWhichKey(wk, { classPrefix: 'myapp' })` plus the README's own `import 'which-key/styles.css'` yields a completely unstyled overlay: the backdrop loses `position:fixed; inset:0`, the popup loses `position:fixed`, and both render inline in the body flow. README.md:243-247 shows the two side by side with no warning they are mutually exclusive; the only hint is docs/API.md:386. Separately the React renderer hardcodes `wk-` in all 18 className literals with no prop to change it.
- Blast radius: src/vanilla/mount.ts:18; src/vanilla/popup.ts:10; src/vanilla/cheatsheet.ts:5; src/styles.css:2; README.md:243; docs/API.md:325,386
- Proposed fix: add an explicit note at README.md:243 and docs/API.md:325 — "Using `classPrefix` opts out of `which-key/styles.css` entirely; you must supply your own stylesheet for the whole class contract." Also state that `classPrefix` is vanilla-only and the React components always emit `wk-`.
- [ ] execute   [ ] skip

### B34. pushLayer accepts an explicit level that silently makes every shortcut on that layer unreachable: `WhichKeyEngine.pushLayer` (src/engine/controller.ts:186)
- Category: api-surface
- Impact: 3 (severity 3 × blast-radius 1)
- Effort: S
- Risk: high
- Evidence: `const level = opts?.level ?? registry.nextLevel();` with no validation. `blockLevel()` floors at 0 and `isReachable` requires `entry.global || entry.level >= block`, so any negative level is permanently unreachable. Verified against the built bundle: `pushLayer({ level: -1 })` then `layer.register('z', …)` leaves `registry.getActive('z') === undefined` — the shortcut is registered, the handle looks healthy, `pop()` works, and the key just never fires. The same silent hole exists for a level that undercuts an already-active exclusive layer. `level` on `pushLayer` is undocumented (see B16) and no test passes an explicit level.
- Blast radius: src/engine/controller.ts:186,196; src/engine/registry.ts:16,22,31
- Proposed fix: validate — if `opts?.level` is supplied and is not a non-negative finite integer, `console.warn` and fall back to `registry.nextLevel()`. Additionally warn when the supplied level is below `registry.nextLevel() - 1` so the undercut case is visible.
- [ ] execute   [ ] skip

### B35. No troubleshooting section documenting the emitted warnings or the silent failure modes: `README.md` (README.md:252)
- Category: observability
- Impact: 3 (severity 1 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: neither README.md nor docs/API.md mentions the string `[whichkey]` or the word "warn" anywhere. A developer who sees `[whichkey] Shortcut "j" registered while another is active…` has no documentation telling them whether it is expected (it is, for the layer pattern the same README teaches). Symmetrically, the failure modes that produce no output at all — a key string that canonicalizes differently than the runtime event (B2, B15), a binding shadowed by an exclusive layer, a shortcut suppressed because focus is in an input — are never listed together as things to check. For a library whose entire failure mode is "nothing happens", this is the difference between a five-minute fix and an abandoned integration.
- Blast radius: README.md:252; docs/API.md:337; src/engine/matcher.ts:43; src/engine/controller.ts:159
- Proposed fix: add a `## Troubleshooting` section to README.md with a checklist — (1) is `<WhichKeyProvider>` an ancestor / did you call `engine.start()`; (2) is focus in an input — set `enableOnInputs: true`; (3) compare `parseKey('<your key>')` against `eventToCanonical(e)` from a raw keydown listener; (4) is an exclusive layer active — use `global: true`; (5) is another registration winning — check level then priority. Add a matching subsection to docs/API.md listing each warning verbatim with its meaning.
- [ ] execute   [ ] skip

### B36. classPrefix is interpolated into className with no validation, so a prefix with spaces splits the class: `MountOptions.classPrefix` (src/vanilla/mount.ts:16)
- Category: api-surface
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: medium
- Evidence: `const prefix = opts.classPrefix ?? 'wk';` is interpolated raw into every className. A prefix containing a space (`'my app'`) produces `class="my app-popup my app-popup--vertical"` — four unrelated classes, none matching the consumer's stylesheet, so the popup renders completely unstyled with no diagnostic. Prefixes starting with a digit or containing `.`/`#`/`:` produce classes that are valid HTML but unselectable without escaping, so `.1x-popup { … }` silently never applies. docs/API.md:325 and README.md:243 advertise the option with no stated constraint.
- Blast radius: src/vanilla/mount.ts:16; src/vanilla/popup.ts:11,17,44; src/vanilla/cheatsheet.ts:5,12; docs/API.md:325; README.md:243
- Proposed fix: validate against `/^-?[A-Za-z_][A-Za-z0-9_-]*$/`; on failure `console.warn('[whichkey] invalid classPrefix "…"; falling back to "wk"')` and use `'wk'`. Document the constraint in docs/API.md:325.
- [ ] execute   [ ] skip

### B37. buildCheatsheetModel silently drops a registered group description when the prefix also has a same-named leaf: `buildCheatsheetModel` (src/engine/controller.ts:66)
- Category: correctness
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: medium
- Evidence: empirically confirmed. The heuristic `entries.length === 1 && entries[0].keys === prefix` routes the bucket to `standalone`, which carries no group description. With `register('g', …)` plus `registerGroup('g', {description: 'Go to'})` the model comes back as `standalone=["g"] groups=[]` — the "Go to" label the consumer registered is never rendered anywhere in the cheatsheet, even though the popup would show it. Neighbouring cases are fine (`'g h'` alone → group; `'g' + 'g h'` → group containing both). controller.ts:230-231 is uncovered and controller.test.ts:94 exercises only the clean partition.
- Blast radius: src/engine/controller.ts:65,66,69; src/react/ShortcutCheatsheet.tsx:34; src/vanilla/cheatsheet.ts:43
- Proposed fix: require that no group label exists for the prefix — `if (entries.length === 1 && entries[0].keys === prefix && !registry.getActiveGroup(prefix))` — so a labelled prefix always renders as a single-entry group section.
- [ ] execute   [ ] skip

### B38. Escape path calls registry.getActive with identical arguments twice in one event: `Matcher.handleKeyDown` (src/engine/matcher.ts:30)
- Category: caching
- Impact: 2 (severity 1 × blast-radius 2)
- Effort: S
- Risk: low
- Evidence: line 30 computes `const escapeLeaf = this.registry.getActive(prospectiveKeys)`; if truthy the code falls through to line 37 which recomputes the byte-identical `this.registry.getActive(prospectiveKeys)` into `leaf`. Each call is a `Map.get` plus `findActive`, which itself does a full `blockLevel()` scan. Pure duplicate work on the Escape-with-pending-buffer path — a micro-optimization, but free to remove.
- Blast radius: src/engine/matcher.ts:30,37
- Proposed fix: hoist the lookup — compute `const leaf = this.registry.getActive(prospectiveKeys);` once before the Escape guard, and change the guard to `if (this.buffer.length > 0 && key === 'Escape' && !leaf) { this.cancel(); return; }`.
- [ ] execute   [ ] skip

### B39. Vanilla example styles a class the renderer never emits, so the demo cheatsheet renders broken: inline stylesheet (examples/vanilla/index.html:52)
- Category: frontend
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: the inline demo CSS defines `.wk-cheatsheet__panel` (line 52) — a class no renderer emits — and styles `.wk-cheatsheet` (line 46) as the full-screen overlay. The actual markup is `.wk-backdrop > .wk-cheatsheet`, and `.wk-backdrop` gets no rule at all, so pressing `?` in this demo produces an unpositioned backdrop in normal flow containing a full-viewport black box with top-left-aligned unstyled text. Two smaller defects in the same file: line 42 adds `content: '+'` via `::before` on `.wk-row--group .wk-row__label` but the renderer already prepends `+` to the label text, so group rows show `++`; and lines 108-109 pin `which-key@0.1.0` from unpkg while package.json is at 0.1.1. Unpublished and eslint-ignored, but it is the copy-paste starting point the file advertises.
- Blast radius: examples/vanilla/index.html:42,46,52,108,109; src/vanilla/cheatsheet.ts:26; src/vanilla/popup.ts:22
- Proposed fix: rename `.wk-cheatsheet` → `.wk-backdrop` and `.wk-cheatsheet__panel` → `.wk-cheatsheet` in the inline `<style>`, delete the `::before { content: '+' }` rule at line 42, and change the two unpkg specifiers to `which-key@latest`.
- [ ] execute   [ ] skip

### B40. wk-cheatsheet__section is emitted by both renderers but has no rule in the shipped stylesheet: `styles.css` (src/styles.css:50)
- Category: frontend
- Impact: 2 (severity 1 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: mechanical diff of emitted vs. defined classes — both ShortcutCheatsheet.tsx:44 and vanilla/cheatsheet.ts:51 emit `wk-cheatsheet__section` on the per-group `<section>`, but src/styles.css has no `.wk-cheatsheet__section` selector (it defines the plural `.wk-cheatsheet__sections` container at :49 and every other cheatsheet child). It is the only class either renderer emits that the shipped theme does not define, so the theme is contractually incomplete — a consumer inspecting the DOM finds a hook the default theme silently ignores. Visually benign today because the flex-column parent supplies the spacing.
- Blast radius: src/styles.css:50; src/react/ShortcutCheatsheet.tsx:44; src/vanilla/cheatsheet.ts:51; README.md:241; docs/API.md:384
- Proposed fix: add `.wk-cheatsheet__section { display: block; }` (or a deliberate margin/`break-inside` rule) next to `.wk-cheatsheet__sections`, and include it in the two class tables alongside the B13 additions.
- [ ] execute   [ ] skip

### B41. CI job runs an unpinned third-party action while holding CODECOV_TOKEN under a default-scoped GITHUB_TOKEN: build job (.github/workflows/ci.yml:20)
- Category: security
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: the workflow declares no `permissions:` block at either level, so `GITHUB_TOKEN` inherits the repository default — read-write `contents` on many repos, letting any step push commits or create releases. In the same job `codecov/codecov-action@v5` is referenced by a mutable major tag rather than a commit SHA and is handed `secrets.CODECOV_TOKEN`; `v5` is a moving pointer the upstream owner can retarget, so a compromised or retagged release executes with the Codecov token in env and the ambient default-scoped `GITHUB_TOKEN` on `push: [main]` runs. Fork `pull_request` runs are already forced read-only by GitHub, so write exposure is limited to same-repo pushes. No hardcoded credentials exist anywhere in the repo — this is the only credential-handling surface.
- Blast radius: .github/workflows/ci.yml:2,7,20,22
- Proposed fix: add a top-level `permissions:\n  contents: read` block after `on:` (no step needs write), and pin the third-party action to a full commit SHA with a trailing version comment: `uses: codecov/codecov-action@<40-char-sha> # v5.x.x`. The first-party `actions/checkout@v4` and `actions/setup-node@v4` may stay on tags.
- [ ] execute   [ ] skip

### B42. Popup-show timer callback leaves a fired timeout handle in this.timer: `Matcher.handleKeyDown` (src/engine/matcher.ts:77)
- Category: caching
- Impact: 1 (severity 1 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: the prefix-only branch assigns `this.timer = setTimeout(...)`, but the callback sets `popupVisible` and calls `onShowPopup` without clearing `this.timer`. Unlike the leaf-and-prefix branch (which ends in `resetBuffer` → `clearTimer`), this path leaves an already-fired Timeout object referenced by the Matcher for as long as the popup stays open. No correctness bug and no unbounded growth (at most one stale handle), but it makes `this.timer !== null` an unreliable signal for "a timer is pending", which blocks using that condition in any future guard.
- Blast radius: src/engine/matcher.ts:77,104
- Proposed fix: add `this.timer = null;` as the first statement of the popup-show timeout callback, mirroring the invariant `clearTimer()` maintains.
- [ ] execute   [ ] skip

### B43. Stale .npmignore shadowed by `files`, and the README's API.md link is unreachable from the tarball: `.npmignore` / `files` (.npmignore:1)
- Category: api-surface
- Impact: 1 (severity 1 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: both `.npmignore` and `package.json` `files` are present; `files` wins, so `.npmignore` is dead config a future maintainer will edit expecting an effect. Verified via `npm pack --dry-run`: the tarball is exactly LICENSE, README.md, package.json and `dist/**` (18 files), so nothing needed is dropped. But README.md:254 links `[docs/API.md](./docs/API.md)` and `docs/` is not in `files`, so the reference the README calls "the full reference" ships as a dangling relative link in the installed package and on npmjs.com.
- Blast radius: .npmignore:1; package.json:27; README.md:254
- Proposed fix: delete `.npmignore` so `files` is the single source of truth, and either add `"docs"` to `files` or change README.md:254 to an absolute GitHub URL so the link resolves from a node_modules copy and from npmjs.com.
- [ ] execute   [ ] skip

> **decision-needed (behavioral):** `ShortcutCheatsheet` rebuilds the whole cheatsheet model in the render body on every re-render (src/react/ShortcutCheatsheet.tsx:26) — `getCheatsheetModel()` runs a full registry scan, a bucketing pass and up to 2+G sorts, and the component re-renders on every emit (today, every keystroke — see B5). The vanilla renderer does not have this problem: mount.ts:41 builds the model once at the open transition. Impact 4 (severity 2 × blast-radius 2). The two fixes trade off differently — a `useMemo` keyed on `visible` matches vanilla's semantics but makes the sheet a snapshot of open-time (late registrations won't appear), while a registry `version` counter preserves freshness but adds a member to `ShortcutRegistry`. Pick the semantics before applying.

> **decision-needed (architectural):** `<WhichKeyLayer>` derives its level from React tree depth (`parent.level + 1`, src/react/WhichKeyLayer.tsx:12), so two sibling layers under the same parent both activate the same level. Confirmed at the engine level: with two exclusive layers at level 1, `blockLevel()` is 1 and `isReachable` uses `entry.level >= block`, so the base shortcut is correctly blocked but each exclusive sibling's shortcuts remain fully reachable from the other — two simultaneously-mounted exclusive modals do not isolate from each other. Impact 4 (severity 2 × blast-radius 2). The fix (allocate per layer instance via `engine.pushLayer` and publish `handle.level` through context as state) changes the level a child sees between first render and post-effect render — a real behavioral change. Decide whether sibling isolation is wanted at all.

> **decision-needed (API):** the shipped theme is dark-only with all 15 colours hardcoded and no custom-property hook (src/styles.css). There is no `@media` rule of any kind — no `prefers-color-scheme` (and correspondingly no `prefers-reduced-motion`, which is harmless since the sheet declares zero transitions). Contrast within the popup is fine, so this is not a legibility defect; the cost is that a light-themed app gets a dark slab and a consumer wanting a light variant must out-specify ~15 rules. Impact 3 (severity 1 × blast-radius 3). Hoisting the palette to `--wk-*` custom properties is a theming-API commitment; the zero-cost alternative is simply documenting "the prebuilt stylesheet is a dark theme" in the README Styling section. Decide which.

> **decision-needed (public-API break):** engine internals `Matcher`, `MatcherOptions`, `ShortcutRegistry` and `resolveSort` are part of the published surface (src/engine/index.ts:3-7, re-exported through `which-key/react`). `Matcher`, `MatcherOptions` and `resolveSort` appear nowhere in docs/API.md — undocumented but publicly importable, so any refactor of the matching loop or sort resolver is a breaking change for whoever reached for them. `ShortcutRegistry` is doubly exposed via `engine.registry`, which docs/API.md:144 calls a "Read-only reference" while the class exposes fully mutating `register`/`unregister`/`activateLayer`. `export * from './types'` also publishes the internal `ShortcutEntry`/`GroupEntry` shapes. Impact 2 (severity 1 × blast-radius 2). Removing them requires a `feat!:` bump; the alternative is documenting them under an explicit "Advanced / unstable" heading. Decide before the 1.0 cut.

## Skip (do not re-flag in future runs)
_(none yet)_
