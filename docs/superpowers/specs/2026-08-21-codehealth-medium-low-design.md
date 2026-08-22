# code-health B14–B43 (Medium + Low) — Execution Design

**Date:** 2026-08-21
**Status:** Approved (user checked `[x] execute` on 28 items in `bughunt.md`)
**Branch:** `codehealth/2026-08-21-batch2` (off `main` @ 09bee08, v0.2.0)
**Source:** `bughunt.md` @ 09bee08 — full evidence, blast radius and scoring live
there; this spec is the execution contract.

## Goal

Fix the 28 findings the user selected from the Medium and Low buckets:
**B14, B16–B40, B42, B43**.

Explicitly **out of scope**:

- **B15** (lowercase/aliased special-key names register dead bindings) and
  **B41** (CI `permissions:` block + unpinned `codecov-action`) — left unchecked
  by the user. They stay in `bughunt.md` verbatim for a later batch. Do not fix
  them, do not strip them.
- All **7 `decision-needed` markers** — never auto-applied. If executing any task
  below turns out to require a big rewrite, a public-API signature break, or an
  architectural change, stop and convert that finding into a `decision-needed`
  marker in `bughunt.md` instead of applying it.

## Toolchain

Node v24.19.0 on the default PATH works; the v24.7.0 workaround recorded in the
B1–B13 spec is no longer needed.

```bash
npm run lint        # eslint .
npm run typecheck   # tsc --noEmit
npm test            # vitest run --coverage, 80% gate on lines/statements/functions/branches
npm run build       # tsup: dual ESM+CJS + .d.ts
```

**Baseline at 09bee08:** typecheck clean, build green, **244 tests passing in 19
files**, coverage 98.83% lines / 94.58% branches. `npm run lint` reports **2
preexisting warnings**, both `Unused eslint-disable directive` in generated
`coverage/` output (`coverage/block-navigation.js`,
`coverage/lcov-report/block-navigation.js`). Those two are the accepted baseline
until B27 removes them by ignoring `coverage/`.

Any of build / typecheck / test going red is a stop-the-line event, not
something to work around. No `--no-verify`, no `--allow-dirty`, no `--force`.

## Line numbers in `bughunt.md` are stale — locate by symbol

`bughunt.md` was written before B1–B13 landed, so its `file:line` references
have drifted. Confirmed examples: B17 cites `src/engine/matcher.ts:62` for the
synthetic `KeyboardEvent`, which now lives at **matcher.ts:98**; B21 cites
matcher.ts:54/73 for branches now at **88** and **108**. **Always locate the code
by the named symbol, never by the cited line.** If a finding's described code no
longer exists, stop and report rather than inventing a fix.

## Per-task contract

One finding per task, one commit per finding, executed in the order below.

1. **If the finding is `risk: high`, write the regression/characterization test
   FIRST**, confirm it FAILS against unchanged code (RED), and commit it as
   `test: characterize <unit> before fix [B<n>]`. This applies to **B17, B18,
   B24, B26, B30, B32, B34** — seven tasks.
2. Apply the fix; the regression test must now pass (GREEN).
3. Run `npm run lint && npm run typecheck && npm test && npm run build`. Fix any
   new warning the change introduced; leave preexisting unrelated ones alone.
4. Commit as `fix(<category>): <summary> [B<n>]` (or `docs(...)` / `chore(...)`
   / `test(...)` where the change is purely that), **stripping that finding's
   entire block from `bughunt.md` in the same commit**. Non-negotiable — the
   heading line, every bullet, and the checkbox line.
5. **Milestone full-suite runs** after tasks 5, 10, 15, 20, 25 and at the end.
   On red: bisect within the batch, revert the offender, surface the diagnosis.

**Test files are never a fix target.** Add NEW tests; do not refactor existing
ones. Two sanctioned exceptions, both because the existing assertion pins the
exact behaviour being corrected:

- **B17** — `src/engine/__tests__/matcher.test.ts` currently asserts
  `expect.any(KeyboardEvent)` for the timeout-fired event. Tightening that
  assertion to the real event is the point of the fix.
- **B27** — enabling `eslint-plugin-react-hooks` may surface `exhaustive-deps`
  findings inside `src/react/__tests__/`. Silence those with a scoped config
  override, not by rewriting the tests.

## Invariants this work depends on

Recorded so a later change that breaks one can be traced here (see the "no test
needed because of invariant X" rule in `CLAUDE.md`):

- **Canonical key strings are the join key.** `parseKey`/`parseSequence`
  (registration) and `eventToCanonical` (runtime) must produce byte-identical
  strings. **B22** extends this invariant to `registerGroup`, which currently
  bypasses it — after B22, group prefixes live in the same namespace as
  shortcut keys. Pin it with a test that registers a non-canonical prefix and
  asserts the group label reaches the popup.
- **`getSnapshot()` returns the cached object.** Never construct a fresh
  snapshot per call — `useSyncExternalStore` will re-render forever. **B21**
  adds a new `onShowPopup` call site; it must route through the existing
  `emit()` path, not mutate `snapshot` directly.
- **Snapshots are deeply immutable.** `onShowPopup` copies the Matcher's live
  `currentSequence`. **B21**'s new call must pass `[...this.buffer]`, not the
  buffer itself.
- **Both renderers emit the same `wk-*` class contract.** **B26** and **B40**
  change `src/styles.css`; **B18** changes the vanilla DOM structure. The class
  names emitted by `src/react/*` and `src/vanilla/*` must stay identical, and
  every emitted class must have a rule in `src/styles.css` (B40 makes this
  mechanically checkable — see task 19).
- **Soft-failure is the library's convention for consumer misuse.**
  `useShortcut` already `console.warn`s on a missing provider rather than
  throwing. **B14, B23, B30, B32, B34, B36** extend that convention to six more
  misuse paths. None of them may start throwing, and none may change a public
  return type.
- **`classPrefix` is vanilla-only and threads through every vanilla class
  write.** **B18** restructures `mount.ts`'s render; the new stable host element
  must still use `${prefix}-`, never a hardcoded `wk-`.

## Execution order and per-finding contract

Ordering rationale: the lint gate goes first so it guards every later React and
vanilla edit; engine internals precede the renderers that read them; packaging
and docs land last so the docs describe final behaviour (B35 in particular must
list every warning added by B14/B23/B30/B32/B34/B36).

### Group 1 — lint gate (must be first)

**Task 1 — B27** (`frontend`, effort S, risk low) — `eslint.config.js`
Add `eslint-plugin-jsx-a11y` and `eslint-plugin-react-hooks` as devDependencies
and append their recommended flat configs **scoped to `src/react/**/\*.tsx`**.
Also add `coverage`to the top-level`ignores`array, which clears the two
baseline`Unused eslint-disable directive`warnings so the rest of the batch runs
against a clean gate. B3 and B7 (the a11y defects this plugin would have caught)
already landed in the B1–B13 batch, so expect few or no new errors — but if the
plugins do surface violations in`src/react/`, fix them; they are in scope as
part of making the gate green. Violations inside `src/react/**tests**/`get a
scoped override instead.
Commit:`chore(lint): add jsx-a11y and react-hooks eslint plugins [B27]`

### Group 2 — engine: matcher

**Task 2 — B17** (`correctness`, effort S, **risk high → RED test first**) —
`src/engine/matcher.ts`, leaf-AND-prefix branch (currently ~line 88–105)
The timeout path constructs `new KeyboardEvent('keydown', { key })` (matcher.ts:98)
and passes it to `onFire`. Because it is never dispatched, `target` is null,
`cancelable` is false so `preventDefault()` silently no-ops, and every modifier
flag reads false.
RED test: register a shortcut that is both a leaf and a prefix, fire it with
Ctrl held from a real target, let the timeout elapse, and assert the handler
receives `event.target === <the real target>`, `event.ctrlKey === true`, and
that `preventDefault()` actually sets `defaultPrevented`.
Fix: capture `const fireEvent = event;` alongside the existing `fireTarget`, and
pass `fireEvent` to `onFire` instead of the synthetic event. Delete the
`new KeyboardEvent(...)` line.
Also tighten the existing `expect.any(KeyboardEvent)` assertion in
`src/engine/__tests__/matcher.test.ts` — sanctioned exception.
Commit: `fix(correctness): pass the real triggering event to a timed-out leaf-and-prefix handler [B17]`

**Task 3 — B21** (`correctness`, effort S, risk medium) — `src/engine/matcher.ts`
The leaf-AND-prefix branch commits the new buffer but never refreshes the popup,
so during the timeout window the popup shows the _previous_ sequence and the
previous candidates — advertising keys that will abort the sequence.
Fix: mirror the prefix-only branch. After `this.commitBuffer(...)` and
`this.clearTimer()` in the leaf-AND-prefix branch, add
`if (this.popupVisible) this.options.onShowPopup({ currentSequence: [...this.buffer] });`
**Interaction with the input-echo latch:** the prefix-only branch guards its
`onShowPopup` behind `if (this.bufferTouchedInput) { ... return; }`. The new
call must respect the same latch — do not surface a buffer that echoed
characters into a text field. Place the new refresh after an equivalent
`bufferTouchedInput` check, or hide the popup as the prefix-only branch does.
Test: register `g h` (leaf) + `g h x` + `g p`, `timeoutMs=50`; after `g` +
timeout assert `seq=['g']`, then press `h` and assert the snapshot immediately
reads `seq=['g','h']` with candidates `['x']`. Add a second test pinning that a
tainted buffer still does not surface.
Commit: `fix(correctness): refresh the popup when a leaf-and-prefix keystroke commits [B21]`

**Task 4 — B38** (`caching`, effort S, risk low) — `src/engine/matcher.ts`
`getActive(prospectiveKeys)` is computed twice with identical arguments on the
Escape path (matcher.ts:63 and :70).
Fix: hoist `const leaf = this.registry.getActive(prospectiveKeys);` above the
Escape guard and change the guard to
`if (this.buffer.length > 0 && key === 'Escape' && !leaf) { this.cancel(); return; }`.
Pure refactor — behaviour must be identical; existing Escape tests are the guard.
Commit: `perf(matcher): compute the prospective leaf once per event [B38]`

**Task 5 — B42** (`caching`, effort S, risk low) — `src/engine/matcher.ts`
The popup-show `setTimeout` callback never clears `this.timer`, leaving a fired
handle referenced for as long as the popup stays open and making
`this.timer !== null` an unreliable "a timer is pending" signal.
Fix: add `this.timer = null;` as the first statement of that callback.
Commit: `fix(matcher): clear the fired timer handle in the popup-show callback [B42]`

> **Milestone: full suite after task 5.**

### Group 3 — engine: registry

**Task 6 — B20** (`correctness`, effort M, risk medium) —
`ShortcutRegistry.getActiveCandidates` (`src/engine/registry.ts`, ~line 129)
`candidateKey` is the full key string for a leaf but `prefix + ' ' + nextKey`
for a deeper sequence, so a leaf `g h` and a deeper `g h i` collide on `'g h'`
and the `seen` Map silently drops whichever arrives second — making the output
registration-order dependent.
Fix: key `seen` by `nextKey` only, and **merge rather than skip** on collision —
promote the surviving entry to `isGroup: true` when any deeper continuation
exists, and resolve the description as
`this.getActiveGroup(subPrefix)?.description ?? existing.description ?? top.description`
so a leaf's own label survives when no group label is registered.
Note `keys` on the emitted candidate: for a promoted entry it should be the
sub-prefix (`prefix + ' ' + nextKey`), matching what the group form already
emits.
Test both registration orders (`['g h','g h i']` and `['g h i','g h']`) and
assert they produce the identical single candidate with `isGroup: true` and the
leaf's description preserved.
Commit: `fix(correctness): merge colliding leaf and deeper-sequence candidates [B20]`

**Task 7 — B19** (`caching`, effort S, risk medium) —
`ShortcutRegistry.blockLevel` (`src/engine/registry.ts:22`)
`blockLevel()` rescans the whole `layers` Map and is called from `findActive`
and `getActiveGroup`, both of which run in loops — so one `getAllActive()` over
N buckets costs N full layer scans.
Fix: add `private blockLevelCache: number | null = null;`, return it when
non-null, and reset it to `null` in `activateLayer` and `deactivateLayer` — the
only two mutators of `layers`, so invalidation is exhaustive. Verify by
inspection that nothing else writes `this.layers`.
Test: a layer activated _after_ a first `getActive` call must still take effect
(pins that invalidation actually fires).
Commit: `perf(registry): cache blockLevel and invalidate on layer changes [B19]`

### Group 4 — engine: controller & keys

**Task 8 — B14** (`api-surface`, effort S, risk medium) —
`createWhichKey.register` (`src/engine/controller.ts:164`)
`register` calls `parseSequence(keys)`, which throws for empty/whitespace-only
strings, unknown modifiers and dangling `+`. `useShortcut` calls it from inside
a `useEffect`, so the throw is unrecoverable and unmounts the consumer's whole
subtree — while the neighbouring missing-provider path merely warns.
Fix, in `createWhichKey.register`:

- if `typeof h !== 'function'`, `console.warn` and return a no-op unregister;
- wrap `parseSequence(keys)` in try/catch; on throw
  `console.warn('[whichkey] invalid key string "<keys>": <msg>; shortcut not registered')`
  and return a no-op unregister.
  Purely internal — the declared return type is unchanged, and `LayerHandle.register`
  inherits the fix because it delegates to `engine.register`.
  Commit: `fix(api-surface): soft-fail register() on an invalid key string or non-function handler [B14]`

**Task 9 — B22** (`api-surface`, effort S, risk medium) —
`WhichKeyEngine.registerGroup` (`src/engine/controller.ts:180`)
`register` canonicalizes via `parseSequence` but `registerGroup` stores `prefix`
raw, so the two key into different namespaces whenever the raw string differs
from its canonical form — `registerGroup('Shift+a', …)` sits under `'Shift+a'`
while the shortcut lands under `'A b'`, and the popup shows a bare key with no
label.
Fix: `registry.registerGroup({ id, prefix: parseSequence(prefix).join(' '), … })`.
This also makes `registerGroup('')` reject the same way `register('')` does —
but per the B14 convention it must **soft-fail with a warn**, not throw. Apply
the same try/catch shape as task 8 and return a no-op unregister.
`useShortcutGroup` inherits the fix via delegation.
Test: `registerGroup('Shift+a', {description:'Shifted group'})` +
`register('Shift+a b', …)` → `getActiveGroup('A')` resolves and the popup
candidate carries the description.
Commit: `fix(api-surface): canonicalize the registerGroup prefix [B22]`

**Task 10 — B23** (`api-surface`, effort S, risk medium) —
`createWhichKey` helpKey registration (`src/engine/controller.ts:146`)
`parseKey(helpKey)` runs unguarded in the factory, so an invalid `helpKey`
throws — and because `WhichKeyProvider` calls `createWhichKey` in its render
body, `<WhichKeyProvider helpKey="ctrl/">` throws during render and unmounts the
consumer's entire tree.
Fix: wrap the `registry.register({...})` helpKey block in try/catch; on parse
failure emit
`console.warn('[whichkey] invalid helpKey "…": <message>; help shortcut disabled')`
and skip registration. The engine must be fully functional afterwards, just
without the `?` binding.
Test: `createWhichKey({ helpKey: 'Hyper+/' })` returns a working engine and warns.
Commit: `fix(api-surface): soft-fail an invalid helpKey instead of throwing from the factory [B23]`

> **Milestone: full suite after task 10.**

**Task 11 — B30** (`api-surface`, effort S, **risk high → RED test first**) —
`createWhichKey` (`src/engine/controller.ts:81`)
`timeoutMs` is destructured with a 500 default and handed straight to
`setTimeout`, which coerces NaN / negative / overflow to 0 — so
`createWhichKey({ timeoutMs: -1 })` makes the popup flash open on the first
keystroke, the documented opposite.
RED test: `createWhichKey({ timeoutMs: -1 })` (and `NaN`) must behave like the
500ms default, not fire at 0.
Fix: clamp at the boundary —
`const timeoutMs = Number.isFinite(raw) && raw >= 0 ? raw : 500;` with a
`console.warn` when a supplied value is rejected. Note the destructuring default
must stay intact for `undefined` (no warn when the option is simply absent).
The public `timeoutMs?: number` signature is unchanged.
Commit: `fix(api-surface): clamp a non-finite or negative timeoutMs to the default [B30]`

**Task 12 — B34** (`api-surface`, effort S, **risk high → RED test first**) —
`WhichKeyEngine.pushLayer` (`src/engine/controller.ts:197`)
`const level = opts?.level ?? registry.nextLevel();` is unvalidated. Since
`blockLevel()` floors at 0 and `isReachable` requires `entry.level >= block`,
any negative level makes every shortcut on that layer permanently unreachable —
registration succeeds, the handle looks healthy, and the key just never fires.
RED test: `pushLayer({ level: -1 })` then `layer.register('z', …)` — assert `z`
fires (after the fix) and that a warning was emitted.
Fix: if `opts?.level` is supplied and is not a non-negative finite integer,
`console.warn` and fall back to `registry.nextLevel()`. Additionally warn (but
still honour the value) when the supplied level is below
`registry.nextLevel() - 1`, so the undercut case is visible.
Commit: `fix(api-surface): validate an explicit pushLayer level [B34]`

**Task 13 — B37** (`correctness`, effort S, risk medium) —
`buildCheatsheetModel` (`src/engine/controller.ts:66`)
The heuristic `entries.length === 1 && entries[0].keys === prefix` routes a
single-entry bucket to `standalone`, which carries no group description — so
`register('g', …)` plus `registerGroup('g', {description:'Go to'})` loses the
"Go to" label entirely from the cheatsheet, even though the popup shows it.
Fix: require that no group label exists for the prefix —
`if (entries.length === 1 && entries[0].keys === prefix && !registry.getActiveGroup(prefix))`
so a labelled prefix always renders as a single-entry group section.
Test: assert the model comes back as one group with `description: 'Go to'`, and
that the unlabelled single-entry case still lands in `standalone`.
Commit: `fix(correctness): keep a group label on a single-entry cheatsheet prefix [B37]`

**Task 14 — B31** (`correctness`, effort S, risk medium) —
`isMacPlatform` (`src/engine/keys.ts:20`)
`/Mac|iPod|iPhone|iPad/.test(navigator.platform)` dereferences `navigator`
unguarded and is reached from `parseKey` for every `Mod+` binding — the spelling
the README recommends. Node only gained a global `navigator` in v21 while
`engines.node` declares `>=20`, so `register('Mod+/')` throws
`ReferenceError: navigator is not defined` on a supported SSR/prerender runtime.
Fix: `if (typeof navigator === 'undefined') return false;` then prefer
`navigator.userAgentData?.platform ?? navigator.platform ?? ''`. `userAgentData`
is not in the default TS DOM lib — type the access narrowly rather than reaching
for `any` (the repo forbids unjustified `any`).
Both existing `Mod` tests (which stub `navigator.platform` via `defineProperty`)
must keep passing. Add a test for the absent-`navigator` path.
Commit: `fix(correctness): guard isMacPlatform against an absent navigator [B31]`

### Group 5 — react

**Task 15 — B24** (`observability`, effort S, **risk high → RED test first**) —
`src/react/context.ts` + four call sites
`useShortcut`, `useShortcutGroup` and `<WhichKeyLayer>` all warn when used
outside a provider, but the three consumers that actually paint —
`useWhichKeyState`, `<ShortcutCheatsheet>` and (via the hook) `<WhichKeyPopup>` —
fall back silently. That makes the single most common integration mistake
present as "the popup never appears while shortcuts still fire".
RED test: render `<WhichKeyPopup />` with no provider and assert a
`[whichkey]` warning naming `<WhichKeyPopup>`.
Fix: extract a shared `warnNoProvider(what: string)` helper in
`src/react/context.ts` that dedupes via a module-level `Set<string>`, and call
it from all the sites — `useWhichKeyState` (naming `<WhichKeyPopup>` /
`useWhichKeyState`), `<ShortcutCheatsheet>`, `useShortcut`, `useShortcutGroup`
and `<WhichKeyLayer>` — so the diagnostics are uniform. Fire from a `useEffect`
so it warns once per mount rather than on every dep change.
**SSR constraint:** `useWhichKeyState` supplies a `getServerSnapshot`; the warn
must not run during render or on the server. A `useEffect` satisfies both.
**Test isolation:** module-level dedupe state leaks across tests in a file —
export a reset for tests or key the Set per message and account for it, and make
sure the existing warn tests for `useShortcut`/`useShortcutGroup`/`WhichKeyLayer`
still pass.
Commit: `fix(observability): warn once when a renderer is mounted outside WhichKeyProvider [B24]`

**Task 16 — B29** (`api-surface`, effort S, risk medium) —
`clamp01` / `clampRows`, duplicated in `src/react/WhichKeyPopup.tsx:12-13` and
`src/vanilla/popup.ts:5-6`
Both are identity for NaN, so `backgroundOpacity={NaN}` emits
`rgba(17, 24, 39, NaN)` — rejected by the CSSOM, leaving the popup with no
background at all and `#f3f4f6` text on the bare host page. `maxRows={NaN}`
yields `repeat(NaN, auto)`.
Fix: make both total — `Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.95`
and `Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 5` — and **hoist the pair
into a shared internal module** so the two copies cannot drift again.
**Placement constraint:** `src/engine/` must stay framework-free and the helpers
are renderer-only, so put them in a new internal module that both renderers
import (e.g. `src/shared/clamp.ts`). Do **not** add them to any public
`index.ts` — they are internal. Confirm `tsup` still builds all three entry
points and that the new module does not create a `react`→`vanilla` dependency.
Test NaN for both helpers through both renderers.
Commit: `fix(api-surface): make clamp01 and clampRows total over NaN and share one copy [B29]`

> **Milestone: full suite after task 15.**

### Group 6 — vanilla + styles

**Task 17 — B18** (`frontend`, effort M, **risk high → RED test first**) —
`mountWhichKey.render` (`src/vanilla/mount.ts:30`)
`render()` unconditionally does `popupNode?.remove(); popupNode = null;` then
re-appends a freshly built node on every emit. Because `.wk-popup` and
`.wk-backdrop` share `z-index: 50`, painting order falls to DOM order — so once
the cheatsheet is open, the next popup render lands _after_ the backdrop and the
popup paints on top of the full-screen overlay. React reconciles in place and
gets this right, so it is a renderer divergence. Every continuation keypress
also discards and reallocates the whole subtree.
RED test: open the cheatsheet, then drive a leader key; assert the popup node
precedes the backdrop node in `container.children` (i.e.
`compareDocumentPosition` puts the popup first). A second assertion: the popup
host element identity is stable across two renders.
Fix: create a stable popup host element once at mount, append it once (before
the cheatsheet is ever appended), and replace only its children each render via
`host.replaceChildren(...)`, toggling `host.hidden` when the snapshot has no
visible popup.
**Constraints:** the host must use `${prefix}-` not a hardcoded `wk-`;
`unmount()` must remove the host; and the existing `data-testid="whichkey-popup"`
/ `role="dialog"` / `aria-label` contract on the rendered popup must be
preserved exactly, since `mount.test.ts` and the styling contract depend on it.
Decide deliberately whether the host itself or the inner node carries those
attributes, and keep whichever the existing tests query.
Commit: `fix(frontend): keep a stable vanilla popup host instead of rebuilding it per emit [B18]`

**Task 18 — B26** (`frontend`, effort S, **risk high → RED test first**) —
`src/styles.css:16,40`
`.wk-popup` and `.wk-backdrop` both hardcode `z-index: 50`, below the stacking
layer every major UI kit uses for modals (Bootstrap 1055, MUI 1300, Ant 1000),
so pressing `?` while any host dialog is open renders the cheatsheet behind it
and unreachable. There is no custom property, so overriding means out-specifying
two shipped selectors.
RED test: a stylesheet-contract test that reads `src/styles.css` as text and
asserts `.wk-popup` and `.wk-backdrop` resolve their `z-index` through
`var(--wk-z-index…)`. (There is no CSS-rendering test infrastructure in this
repo; a text assertion over the shipped sheet is the honest guard, and task 19
extends the same test file.)
Fix: `z-index: var(--wk-z-index, 1000);` on `.wk-popup` and
`z-index: var(--wk-z-index-backdrop, var(--wk-z-index, 1000));` on `.wk-backdrop`,
and document both variables in the README Styling section.
Commit: `fix(frontend): expose the overlay z-index as a CSS custom property [B26]`

**Task 19 — B40** (`frontend`, effort S, risk medium) — `src/styles.css:50`
`wk-cheatsheet__section` is emitted by both `ShortcutCheatsheet.tsx` and
`vanilla/cheatsheet.ts` but has no rule in the shipped stylesheet — the only
emitted class the default theme does not define.
Fix: add `.wk-cheatsheet__section { display: block; }` next to
`.wk-cheatsheet__sections`, and add the class to the two class tables in
`README.md` and `docs/API.md`.
**Extend the task 18 stylesheet-contract test** into the mechanical check the
finding's evidence describes: collect every `wk-*` class literal emitted by
`src/react/**` and `src/vanilla/**` and assert each has a selector in
`src/styles.css`. That guard is what stops the contract drifting again.
Commit: `fix(frontend): define the missing wk-cheatsheet__section rule [B40]`

**Task 20 — B32** (`api-surface`, effort S, **risk high → RED test first**) —
`mountWhichKey` (`src/vanilla/mount.ts:12`)
Nothing tracks whether a container already has a renderer attached, so a
hot-reload re-run or a double-wire yields two subscriptions and two nodes both
carrying `data-testid="whichkey-popup"` and `role="dialog" aria-label="Keyboard
shortcuts"` — an a11y defect — with the escape listener registered twice and the
first `unmount()` leaving the second renderer live.
RED test: call `mountWhichKey(engine)` twice on the same container; assert a
warning and exactly one popup host.
Fix: keep a module-level `WeakSet<HTMLElement>` of containers with a live mount;
on a repeat mount
`console.warn('[whichkey] mountWhichKey called twice for the same container; the previous mount is still active')`.
Make `unmount()` idempotent and clear the WeakSet entry. Return type unchanged.
**Decide and document** in the commit body what the second call returns — a
working handle for the second mount, or a no-op handle. Prefer the no-op handle
with the warning (matching the soft-failure convention), and pin it with the test.
Commit: `fix(api-surface): warn and no-op on a duplicate mountWhichKey for one container [B32]`

> **Milestone: full suite after task 20.**

**Task 21 — B36** (`api-surface`, effort S, risk medium) —
`MountOptions.classPrefix` (`src/vanilla/mount.ts:16`)
`classPrefix` is interpolated raw into every className, so `'my app'` produces
`class="my app-popup …"` — four unrelated classes and a completely unstyled
popup with no diagnostic. A prefix starting with a digit or containing `.`/`#`/`:`
is unselectable without escaping.
Fix: validate against `/^-?[A-Za-z_][A-Za-z0-9_-]*$/`; on failure
`console.warn('[whichkey] invalid classPrefix "…"; falling back to "wk"')` and
use `'wk'`. Document the constraint in `docs/API.md` (the `classPrefix` row).
Commit: `fix(api-surface): validate classPrefix and fall back to "wk" [B36]`

**Task 22 — B25** (`api-surface`, effort S, risk low) — `src/vanilla/index.ts`
`docs/API.md` types the `popup` option as `Partial<PopupOptions> | false` and
gives `PopupOptions` its own table, but `src/vanilla/index.ts` only re-exports
`mountWhichKey` and `MountOptions`, so a consumer cannot import the type they
are told to use. Likewise `mountWhichKey`'s return is an inline anonymous
`{ unmount(): void }` with no exported alias.
Fix: add `export type { PopupOptions } from './popup';` to `src/vanilla/index.ts`,
and export a named `WhichKeyMountHandle = { unmount(): void }` from `mount.ts`,
using it as `mountWhichKey`'s declared return type. Both additive — existing
structural usage keeps compiling.
Add both to `docs/API.md` (named exports must be documented there per CLAUDE.md).
Verify against the built `dist/vanilla/index.d.ts` that both names now appear in
the terminal export list.
Commit: `fix(api-surface): export PopupOptions and WhichKeyMountHandle from which-key/vanilla [B25]`

### Group 7 — packaging & examples

**Task 23 — B39** (`frontend`, effort S, risk low) — `examples/vanilla/index.html`
The inline demo CSS styles `.wk-cheatsheet__panel` — a class no renderer emits —
and treats `.wk-cheatsheet` as the full-screen overlay, while the real markup is
`.wk-backdrop > .wk-cheatsheet` with no rule for `.wk-backdrop`. Pressing `?`
therefore renders an unpositioned backdrop in normal flow around a full-viewport
black box of unstyled text.
Fix: in the inline `<style>`, rename `.wk-cheatsheet` → `.wk-backdrop` and
`.wk-cheatsheet__panel` → `.wk-cheatsheet`; delete the
`::before { content: '+' }` rule on `.wk-row--group .wk-row__label` (the
renderer already prepends `+`, so group rows currently show `++`); and change
the two `which-key@0.1.0` unpkg specifiers to `which-key@latest`.
`examples/` is eslint-ignored and untested, so verify by reading the emitted
class names in `src/vanilla/cheatsheet.ts` and `src/vanilla/popup.ts` and
confirming every selector in the demo stylesheet matches one.
Commit: `fix(frontend): correct the vanilla example's cheatsheet selectors [B39]`

**Task 24 — B43** (`api-surface`, effort S, risk low) — `.npmignore` / `README.md`
Both `.npmignore` and `package.json` `files` exist; `files` wins, so `.npmignore`
is dead config a future maintainer will edit expecting an effect. Separately,
`README.md` links `[docs/API.md](./docs/API.md)` but `docs/` is not in `files`,
so the reference the README calls "the full reference" ships as a dangling
relative link in the installed package and on npmjs.com.
Fix: delete `.npmignore`, and change the README link to an absolute GitHub URL
so it resolves from a `node_modules` copy and from npmjs.com. (Prefer the
absolute URL over adding `"docs"` to `files` — it keeps the tarball lean and
also fixes the npmjs.com rendering, which a bundled file would not.)
Verify with `npm pack --dry-run` that the tarball contents are unchanged:
LICENSE, README.md, package.json and `dist/**`.
Commit: `chore(packaging): drop the dead .npmignore and fix the README API link [B43]`

### Group 8 — docs (last — they describe final behaviour)

**Task 25 — B16** (`api-surface`, effort M, risk low) — `docs/API.md`
The file README calls "the full reference" omits the entire layers API.
Fix, all in `docs/API.md`:

- add `engine.pushLayer(options?)` and `engine.activateLayer(level, exclusive)`
  sections plus a `LayerHandle` type block to the `WhichKeyEngine` section;
- add a `<WhichKeyLayer>` section and a matching table-of-contents entry to the
  React section, covering `WhichKeyLayerProps`;
- add the real `global` and `level` rows to the `ShortcutOptions` table;
- add `level` to the `registerGroup` options table;
- correct the `popup` default from `{}` to
  `{layout:'vertical', maxRows:5, backgroundOpacity:0.95}`.
  Also fold in the doc notes tasks 8/10/11/12 owe: the soft-failure behaviour of
  `register`, the `helpKey` warn-and-disable path, the `timeoutMs` clamp, and
  `pushLayer`'s `level` validation.
  Cross-check every documented signature against `src/engine/controller.ts` and
  `src/engine/types.ts` rather than against the prose already in the file.
  Commit: `docs(api): document the layers API and correct ShortcutOptions drift [B16]`

> **Milestone: full suite after task 25.**

**Task 26 — B28** (`observability`, effort S, risk low) — `docs/API.md`
`parseKey`, `parseSequence` and `eventToCanonical` are already exported from
`src/engine/index.ts` and re-exported through `which-key/react` — and are
exactly the tools that diagnose a canonicalization mismatch — but appear nowhere
in the docs. `engine.registry` is documented as nothing but "Read-only
reference… Advanced use only." with no members.
Fix: add a short **Debugging** heading to `docs/API.md` documenting
`parseKey(keys)` / `parseSequence(keys)` / `eventToCanonical(event)` with the
canonical-form-inspection recipe (compare `parseKey('<your key>')` against
`eventToCanonical(e)` from a raw keydown listener), and document
`registry.getAllActive()` as the supported way to list live bindings.
Out of scope: a new `registry.explain(keys)` method — that is a public-API
addition, not a doc fix.
Commit: `docs(api): document the key-canonicalization debugging exports [B28]`

**Task 27 — B33** (`frontend`, effort S, risk medium) — `README.md` / `docs/API.md`
`classPrefix` threads correctly through all 23 vanilla class writes, but
`src/styles.css` hardcodes `.wk-*` in all 24 selectors — so
`mountWhichKey(wk, { classPrefix: 'myapp' })` plus the README's own
`import 'which-key/styles.css'` yields a completely unstyled overlay, and the
README shows the two side by side with no warning that they are mutually
exclusive.
Fix: add an explicit note in the README Styling section and at the `classPrefix`
row in `docs/API.md` — "Using `classPrefix` opts out of `which-key/styles.css`
entirely; you must supply your own stylesheet covering the whole class
contract." Also state that `classPrefix` is **vanilla-only** and that the React
components always emit `wk-`. Docs-only.
Commit: `docs(styling): document that classPrefix opts out of the shipped stylesheet [B33]`

**Task 28 — B35** (`observability`, effort S, risk low) — `README.md` / `docs/API.md`
Neither file mentions `[whichkey]` or the word "warn" anywhere, and the
failure modes that produce no output at all are never listed together — for a
library whose entire failure mode is "nothing happens", that is the difference
between a five-minute fix and an abandoned integration.
Fix: add a `## Troubleshooting` section to `README.md` with the checklist —
(1) is `<WhichKeyProvider>` an ancestor / did you call `engine.start()`;
(2) is focus in an input — set `enableOnInputs: true`;
(3) compare `parseKey('<your key>')` against `eventToCanonical(e)` (link the
B28 Debugging section);
(4) is an exclusive layer active — use `global: true`;
(5) is another registration winning — check level, then priority.
Add a matching subsection to `docs/API.md` listing **each emitted warning
verbatim with its meaning**.
**This task runs last because it must enumerate every warning in the final tree.**
Before writing, `grep -rn 'console.warn' src/` and document every hit — including
the ones added by B14, B22, B23, B24, B30, B32, B34 and B36 in this batch. Also
mention B15 (unrecognized special-key base names silently never match) in the
canonicalization checklist item, since B15 itself is deferred and consumers can
still hit it.
Commit: `docs(troubleshooting): add a README troubleshooting section and warning reference [B35]`

## Definition of done

- All 28 findings fixed, each with its own commit, each stripping its own block
  from `bughunt.md` in that same commit.
- `bughunt.md` afterwards contains **only**: the header/how-to-use preamble
  (with an updated "Last triage" line), **B15**, **B41**, and the 7
  `decision-needed` markers. Nothing else.
- `npm run lint && npm run typecheck && npm test && npm run build` all green.
- Coverage stays at or above the 80% gate on all four metrics (it starts at
  ~98.8% lines / ~94.6% branches — a large regression means a fix shipped
  untested).
- `npm pack --dry-run` still produces LICENSE, README.md, package.json and
  `dist/**`.
- No summary commit — the per-finding commits are the audit trail.
