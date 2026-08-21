# code-health B1–B13 (Critical + High) — Execution Design

**Date:** 2026-08-21
**Status:** Approved (user checked `[x] execute` on B1–B13 in `bughunt.md`)
**Branch:** `codehealth/2026-08-21`
**Source:** `bughunt.md` @ 414fbc4 — full evidence, blast radius and scoring live there; this spec is the execution contract.

## Goal

Fix the 13 highest-impact findings from the code-health audit: every Critical
(B1–B3) and every High (B4–B13) item. Findings B14–B43 are explicitly **out of
scope** — they stay in `bughunt.md` for a later batch. The 7 `decision-needed`
markers are **never** auto-applied.

## Toolchain

`node` v24.7.0 is required — the default-PATH nvm install (v24.19.0) is broken
(missing `lib/node_modules`). Every command in this spec assumes:

```bash
export PATH="$HOME/.nvm/versions/node/v24.7.0/bin:$PATH"
npm run lint        # eslint .            — currently clean
npm run typecheck   # tsc --noEmit        — currently clean
npm test            # vitest run --coverage, 80% gate — 192 passing
npm run build       # tsup                — currently succeeds
```

Baseline at 414fbc4: lint clean, typecheck clean, build green, **192 tests
passing**, coverage 96.3% lines / 92.24% branches. Any of these going red is a
stop-the-line event, not something to work around. No `--no-verify`, no
`--allow-dirty`.

## Per-task contract

One finding per task, one commit per finding, executed in the order below.

1. **If the finding is `risk: high`, write the regression/characterization test
   FIRST**, confirm it FAILS against unchanged code (RED), and commit it as
   `test: characterize <unit> before fix [B<n>]`. This applies to B1, B3, B4,
   B9, B10.
2. Apply the fix; the regression test must now pass (GREEN).
3. Run `npm run lint && npm run typecheck && npm test && npm run build`. Fix any
   new warning the change introduced; leave preexisting unrelated ones alone.
4. Commit as `fix(<category>): <summary> [B<n>]`, **stripping that finding's
   entire block from `bughunt.md` in the same commit**. Non-negotiable.
5. Milestone full-suite runs after B5, after B8, and at the end.

**Test files are never a fix target.** The one sanctioned exception is B8, whose
fix necessarily changes assertions in `src/engine/__tests__/registry.test.ts`
because those tests pin the exact warning text being corrected. Everywhere else,
add NEW tests; do not refactor existing ones.

## Invariants this work depends on

Recording these so a later change that breaks one can be traced here (see the
"no test needed because of invariant X" rule in `CLAUDE.md`):

- **Canonical key strings are the join key.** `parseKey` (registration) and
  `eventToCanonical` (runtime) must produce byte-identical strings, or a
  registry `Map.get` misses and the shortcut silently never fires. B2 and B11
  both operate on this seam; each must land with a **round-trip test** asserting
  `parseKey(x) === eventToCanonical(syntheticEventFor(x))`, not merely a
  unit test of `parseKey` in isolation.
- **`getSnapshot()` returns a cached, stable reference.** `useSyncExternalStore`
  loops forever if it returns a fresh object per call. B5 changes when `emit()`
  fires; it must not change this.
- **Snapshots are deeply immutable.** The defensive `[...state.currentSequence]`
  copy in `controller.ts` is deliberate; preserve it.
- **The engine is framework-free.** No React import may enter `src/engine/`.
- **`start()` is the only place allowed to touch `document`.** B1 establishes
  this; B9/B10 must not reintroduce a module-scope or constructor-time DOM
  dereference.

## Execution order and task specs

Ordered by impact, with two dependency-driven adjustments noted inline.

### Task 1 — B1: SSR crash from eager `document` dereference (impact 25, risk high)

`src/engine/controller.ts:81` destructures `target = document`, evaluated at
construction. `WhichKeyProvider` calls `createWhichKey` in its **render body**,
so server rendering throws `ReferenceError: document is not defined`.

- **RED test first:** a `renderToString(<WhichKeyProvider><WhichKeyPopup/><ShortcutCheatsheet/></WhichKeyProvider>)`
  test that currently throws. Put it in a new `src/react/__tests__/ssr.test.tsx`
  using `react-dom/server`. It must exercise the Provider, not just the leaves.
- **Fix:** stop resolving `target` at construction. Keep `const explicitTarget =
  options.target;` and resolve inside `start()`:
  `bound = explicitTarget ?? (typeof document !== 'undefined' ? document : null)`,
  then `bound?.addEventListener('keydown', handler)`. Mirror in `stop()`; both
  no-op when `bound` is null. `start()` only runs from the Provider's effect,
  which does not execute on the server.
- **Do not** change the `WhichKeyOptions.target` public type.

### Task 2 — B2: `Shift+<punctuation>` never fires (impact 20, risk medium)

`buildCanonical` drops Shift for non-letter, non-special bases, so
`parseKey('Shift+/')` → `/` while runtime yields `?`. The binding is dead **and**
hijacks the plain `/` key.

- **Implement tier (a) from the finding, not tier (b).** Correct the docs so the
  documented spelling is the shifted glyph itself (`'?'`, which already works on
  every layout because `eventToCanonical` reads `event.key` verbatim), and add a
  `console.warn` in `parseKey` when `Shift+` is combined with a printable
  non-letter base, since the Shift is being discarded.
- **Rationale for rejecting tier (b):** the US-layout glyph map (`1`→`!`,
  `/`→`?`, …) would make `Shift+/` work on US keyboards while silently
  mis-binding on others — e.g. German `Shift+7` yields `/`, so a US map would
  register `&`. Writing the shifted character directly is layout-agnostic and
  strictly correct. Making the failure loud replaces the silent-dead-shortcut
  severity; guessing a layout does not.
- **Edits:** `src/engine/keys.ts` (warn + the misleading comment at :37),
  `README.md:81` (syntax table), `docs/API.md:360`.
- **Tests:** a round-trip test proving `parseKey('?')` matches
  `eventToCanonical` for a Shift+/ event, and a test asserting the warn fires
  for `'Shift+/'`. `keys.test.ts:117` (`parseKey('Shift+?') === '?'`) must stay
  green — do not modify it.

### Task 3 — B3: cheatsheet a11y — no focus management (impact 20, risk high)

Both renderers set `role="dialog"` with no `aria-modal`, no focus move, no trap,
no restoration, no close button, and never hide the background from AT.

- **RED tests first:** assert (React and vanilla) that opening the cheatsheet
  moves focus into the panel, that Tab stays within it, and that closing
  restores focus to the previously-focused element. These fail today.
- **Fix, applied identically in `src/react/ShortcutCheatsheet.tsx` and
  `src/vanilla/cheatsheet.ts`:** add `aria-modal="true"`, `tabIndex={-1}`, and
  `aria-labelledby` pointing at the existing `<h2 class="wk-cheatsheet__title">`
  (give it a stable id); add a keyboard-reachable close button as the panel's
  first child (class `wk-cheatsheet__close`); capture `document.activeElement`
  on open and focus the panel; restore focus on close; add a Tab keydown handler
  cycling among focusable descendants.
- React: inside the existing `visible`-guarded `useEffect`. Vanilla:
  `renderCheatsheet` returns a teardown that `mount.ts` invokes on removal.
- The new `wk-cheatsheet__close` class must be added to `src/styles.css` **and**
  to both documented class tables (coordinate with Task 13/B13).

### Task 4 — B4: consumer handler exceptions wedge the matcher (impact 16, risk high)

`onFire` calls consumer code with no `try`, and both call sites rely on it
returning normally to reach `resetBuffer()`. A throwing handler leaves a stale
buffer, a stuck popup, and silently mismatches every later shortcut.

- **RED test first:** register a handler that throws, fire it, then assert the
  next unrelated shortcut still fires and the popup is not stuck visible. Cover
  both the immediate-leaf path and the `setTimeout` leaf-AND-prefix path
  (`matcher.ts:59-61`, currently uncovered).
- **Fix:** wrap both `onFire` call sites in `try { … } finally { this.resetBuffer(); }`
  in `src/engine/matcher.ts`, and in `src/engine/controller.ts:117` catch and
  attribute: `console.error(\`[whichkey] Handler for "${entry.keys}" threw; sequence state was reset.\`, err)`.
- The error must still be visible to the consumer — do not swallow it silently.

### Task 5 — B5: no-op snapshot emitted on every keystroke (impact 15, risk medium)

`resetBuffer()` runs for every key that matches nothing and unconditionally
calls `onHidePopup()`, emitting a fresh deep-equal snapshot that re-renders every
React subscriber on every keypress anywhere in the host app.

- **Fix:** guard the controller callback —
  `onHidePopup: () => { if (!popupVisible && currentSequence.length === 0) return; popupVisible = false; currentSequence = []; emit(); }`.
- **Test:** subscribe a spy, dispatch N non-matching keystrokes on an idle
  engine, assert zero notifications; then assert a real state change still
  notifies exactly once.
- Must not break the stable-`getSnapshot` invariant — add an assertion that
  `getSnapshot()` returns an identical reference across non-matching keystrokes.

> **Milestone:** full `npm test` after this task.

### Task 6 — B6: full candidate list built per keystroke just to test emptiness (impact 15, risk medium)

`getActiveCandidates` (a full Map scan plus allocations) is called on every
keydown but consumed only as `.length === 0`; when the popup is visible the same
scan runs a second time inside `emit()`.

- **Fix:** add `hasCandidates(prefix: string): boolean` to `ShortcutRegistry` —
  scan `shortcuts`, return true on the first key where
  `keys.startsWith(prefix + ' ')` and `findActive(bucket)` is defined; no
  allocation, no `getActiveGroup` calls, early exit. Replace the three
  `candidates.length` checks in `handleKeyDown` and drop the local binding.
- **Test:** assert `hasCandidates` agrees with `getActiveCandidates().length > 0`
  across leaf-only, group-only, mixed, disabled-entry and blocked-by-exclusive-layer
  cases. Behaviour must be identical — this is a pure optimization.

### Task 7 — B7: popup `role="dialog"` is silent to screen readers (impact 15, risk medium)

*Sequenced after B5 deliberately:* B5 stops the per-keystroke emit storm, so the
live region introduced here only announces on real state changes.

- **Fix:** replace `role="dialog" aria-label="Keyboard shortcuts"` with
  `role="status" aria-live="polite" aria-atomic="true" aria-label="Keyboard shortcuts"`
  at `src/react/WhichKeyPopup.tsx:34`, `:44`, and `src/vanilla/popup.ts:46-47`.
- **Test:** assert the role/aria attributes in both renderers (no such assertion
  exists today in either suite).
- **Known residual:** the vanilla renderer still rebuilds the popup node on each
  emit (B18, not in this batch), so while the popup is *open* each candidate
  change re-announces. After B5 that only happens on genuine sequence progress,
  which is defensible for a live region. Note it in the B18 finding text rather
  than expanding scope here.

### Task 8 — B10: shadow-DOM input-guard bypass (impact 12, risk high)

*Sequenced before B9 deliberately:* B9's guard must consume the target B10
resolves, or the two fixes disagree about what "the target" is.

- **RED test first:** build an open shadow root containing an `<input>`, dispatch
  a composed keydown from it, and assert a shortcut with the default
  `enableOnInputs: false` does **not** fire. Fails today.
- **Fix:** at the top of `handleKeyDown`, resolve
  `const eventTarget = typeof event.composedPath === 'function' ? (event.composedPath()[0] ?? event.target) : event.target;`
  and use it at `matcher.ts:43` and for `fireTarget` at `:56`.
- **Do not change the exported `isInputTarget` signature** — it is public API.
  `composedPath()[0]` equals `event.target` outside shadow DOM, so non-shadow
  behaviour must remain byte-identical; assert that with an existing-behaviour test.

### Task 9 — B9: popup renders keystrokes typed into inputs (impact 12, risk high)

The prefix-only branch has no input guard, so typing a leader character into a
text or password field pops the overlay and renders the typed characters.

- **RED test first:** with `register('g h', …, { enableOnInputs: false })`, type
  `g` into an `<input type="password">`, advance timers past `timeoutMs`, and
  assert the popup is **not** visible. Fails today.
- **Fix:** capture `const inInput = isInputTarget(eventTarget)` (the B10-resolved
  target) once at the top of `handleKeyDown` and wrap the popup show/refresh block
  (`matcher.ts:73-81`) in `if (!inInput) { … }`.
- **Leave `commitBuffer` on :71 unchanged** so a deeper leaf with
  `enableOnInputs: true` can still complete and fire — only the *visual* display
  is gated. Add a test proving that still works.

### Task 10 — B8: duplicate-registration warning cries wolf (impact 12, risk medium)

The warn fires on bare `bucket.length > 0`, so it triggers on the documented
layer-override pattern, and its message misstates which entry wins and reports
`(no description)` for a blocked entry that has one.

- **Fix:** insert first, then call `findActive(bucket)`; warn only when the new
  entry is **not** the winner **and** the pre-existing winner is at the same
  `level` (a genuine same-level collision, not a layer override). Skip entirely
  when levels differ or `findActive` returns undefined. Rewrite the message to
  state the real outcome with both levels and priorities.
- **Sanctioned existing-test edit:** `registry.test.ts:77-85` pins the current
  substring and `:87-90` pins no-warn-on-first-registration. Update :77-85 to the
  new wording; :87-90 should still pass unchanged. Add NEW tests for: exclusive
  layer override → silent; disabled-only existing entry → silent; same-level
  same-priority collision → warns with correct winner.

> **Milestone:** full `npm test` after this task.

### Task 11 — B11: lowercase modifiers rejected despite docs (impact 12, risk medium)

`KNOWN_MODIFIERS` is case-sensitive, so `parseKey('ctrl+s')` throws, while
README.md:85 and docs/API.md:351 both promise case-insensitivity.

- **Fix:** normalize before lookup via
  `MODIFIER_ALIASES = new Map([['ctrl','Ctrl'],['control','Ctrl'],['alt','Alt'],['option','Alt'],['shift','Shift'],['cmd','Cmd'],['meta','Cmd'],['command','Cmd'],['mod','Mod']])`,
  then `const mod = MODIFIER_ALIASES.get(seg.toLowerCase()); if (!mod) throw …`.
  Apply the same lowercase lookup to the bare-modifier check at `keys.ts:73`.
- Strictly widens accepted input. `keys.test.ts:155` (`parseKey('Hyper+K')`
  throws) must stay green.
- **Test:** round-trip each alias form against `eventToCanonical`, per the
  canonical-key invariant above.

### Task 12 — B12: `exports` never points at the emitted `.d.cts` (impact 12, risk medium)

Flat `{ types, import, require }` serves one ESM-flavoured `.d.ts` to both
conditions, so `moduleResolution: node16` CJS consumers get a declaration-format
mismatch. The `.d.cts` files are already emitted and shipped, just unreferenced.

- **Fix:** nest per-format with `types` first in each branch, for all three
  subpaths:
  `"./react": { "import": { "types": "./dist/react/index.d.ts", "default": "./dist/react/index.js" }, "require": { "types": "./dist/react/index.d.cts", "default": "./dist/react/index.cjs" } }`.
- Leave `"./styles.css"` as-is.
- **Verify:** `npm run build && npm pack --dry-run`, and confirm every path named
  in `exports` exists in `dist/`. A script that reads `package.json` `exports`
  and stats each target is the durable form of this check — add it as a test.

### Task 13 — B13: CSS class contract table is wrong and incomplete (impact 12, risk low)

Both renderers emit 23 classes; both documented tables list 14, and the one
cheatsheet row present mislabels `wk-cheatsheet` (the inner panel) as the
backdrop — the overlay is the undocumented `wk-backdrop`.

- **Risk downgraded to low:** the finding carried `risk: high` from the lens
  because nothing tests the contract, but a documentation edit cannot regress
  runtime behaviour. No characterization test is required *for the docs*.
- **Fix:** add the 10 missing cheatsheet classes plus `wk-backdrop` to both
  `README.md:226-241` and `docs/API.md:370-384`; correct the `wk-cheatsheet` row
  to "Cheatsheet panel (scrollable content box)"; add a `wk-backdrop` row. Include
  `wk-cheatsheet__close` from Task 3.
- **Add a drift guard (this is the load-bearing part):** a test that renders both
  renderers, collects every emitted class name, and asserts the set equals a
  canonical exported list. Without it the tables drift again on the next change —
  which is exactly how they got wrong.

## Out of scope

- B14–B43 remain in `bughunt.md`, untouched.
- All 7 `decision-needed` markers remain markers. In particular, **do not** make
  the cheatsheet modal (that marker), add an `onWarn` option, portal the React
  overlays, or change `WhichKeyLayer`'s level allocation while executing this batch.
- No dependency upgrades, no `eslint-plugin-jsx-a11y` (B27 is unselected), no
  version bump, no publish.

## Definition of done

- 13 fix commits (plus 5 preceding `test:` characterization commits), each
  stripping its finding from `bughunt.md`.
- `bughunt.md` contains exactly B14–B43 and the 7 markers.
- `npm run lint && npm run typecheck && npm test && npm run build` all green,
  with test count strictly greater than the 192 baseline.
