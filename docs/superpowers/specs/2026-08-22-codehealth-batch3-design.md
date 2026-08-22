# code-health batch 3 — Execution Design

**Date:** 2026-08-22
**Status:** Approved (maintainer checked `[x] execute` on 7 items, with written direction on the two decision-needed markers)
**Branch:** `codehealth/2026-08-22-batch3`, stacked on `codehealth/2026-08-21-batch2` (PR #2, open)
**Source:** `bughunt.md` @ eb6a9e9 — full evidence and scoring live there; this spec is the execution contract.

## Goal

Fix five findings and implement two decision-needed markers the maintainer has
now given direction on:

| #   | Item                                                                             | Effort | Risk   |
| --- | -------------------------------------------------------------------------------- | ------ | ------ |
| 1   | **B47** — `helpKey: ''` silently disables help                                   | S      | low    |
| 2   | **B45** — negative `level` on `register`/`registerGroup` is silently unreachable | S      | medium |
| 3   | **B44** — a tainted leaf-AND-prefix keystroke leaves the popup stale             | S      | medium |
| 4   | **B15** — lowercase/aliased special-key names register dead bindings             | M      | medium |
| 5   | **D1** — cheatsheet model rebuilt on every render → registry `version` counter   | M      | medium |
| 6   | **B46** — eight public exports absent from `docs/API.md`                         | M      | low    |
| 7   | **D2** — dark-only theme → `prefers-color-scheme` + author override              | L      | high   |

### Out of scope — must remain untouched in `bughunt.md`

- **B41** (CI `permissions:` + unpinned action) — left unchecked.
- **Five decision-needed markers** with no direction: cheatsheet-not-modal,
  unsilenceable warnings, no React portal, sibling-layer isolation, and the
  engine-internals public-API break. Never auto-applied.

## Why this is a stacked branch

PR #2 (51 commits, batch 2) is open and under review. These seven build directly
on it — B45 reuses B34's validation shape, B47 completes B23's soft-failure
convention, B44 closes a gap B21 opened, B46 finishes the sweep B16/B28 started —
so they cannot branch from `main`. Stacking keeps PR #2 stable while it is
reviewed. The maintainer decides at the end whether to merge separately or fold in.

## Toolchain

```bash
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit
npm test             # vitest run --coverage, 80% gate
npm run build        # tsup
npm run format:check # prettier --check .
```

**Baseline at eb6a9e9:** lint 0/0, typecheck clean, **313 tests in 20 files**,
coverage 99.65% statements / 96.79% branches, build green, `npm pack --dry-run`
18 files.

A husky **pre-commit hook** now runs `lint-staged` → `prettier --write` on staged
files and re-stages them, so formatting self-corrects. Do not fight it; do not
`--no-verify`.

## Per-task contract

One item per task, one commit per item, in the order above.

1. Read the finding in `bughunt.md` (evidence, proposed fix, risk).
2. **`risk: high` opens with a RED test in its own commit** — that is **D2 only**
   (task 7), committed as `test: characterize the dark-only theme before fix [D2]`.
   Every other task may use a single commit but must still report RED and GREEN
   evidence.
3. Apply the fix; the test must pass.
4. Run the full verification. Fix warnings the change introduced.
5. **Commit, stripping that item's entire block from `bughunt.md` in the same
   commit** — heading, bullets, checkbox line, and for the two decision-needed
   markers the `> **decision-needed …**` blockquote plus its `User Note` line.
6. **Milestone full-suite runs** after tasks 3, 5 and 7.

**Test files are never a fix target** — add NEW tests, do not refactor existing
ones. **One sanctioned exception, task 7 (D2) only:** seven existing assertions
on `popup.style.backgroundColor` pin the exact inline value D2 deliberately
changes. They are listed in task 7 and may be updated. Nowhere else.

## Invariants this work depends on

Recorded so a later change that breaks one can be traced here (per the
"no test needed because of invariant X" rule in `CLAUDE.md`):

- **Canonical key strings are the join key.** `parseKey`/`parseSequence`
  (registration) and `eventToCanonical` (runtime) must produce byte-identical
  strings. **B15 changes what `parseKey` produces for aliased bases** — it must
  produce exactly what `eventToCanonical` emits for the corresponding real key,
  or the fix creates the very dead binding it removes. Pin with round-trip tests.
- **Soft failure is the convention for consumer misuse.** Warn with a
  `[whichkey] ` prefix, never throw, never change a public return type. B15,
  B45 and B47 all extend it. `docs/API.md`'s Console warnings table is the
  published register of these — **every new warning goes in it**.
- **`getSnapshot()` returns the cached object**, and snapshots are deeply
  immutable. D1 must not make the cheatsheet model part of the snapshot.
- **Both renderers emit the same `wk-*` class contract**, guarded mechanically by
  `src/__tests__/class-contract.test.tsx`. D2 must not break that guard, and any
  class it adds must join the `CONTRACT` array and both doc tables.
- **The input-echo latch (`bufferTouchedInput`) is load-bearing.** B44 changes
  behaviour _inside_ that latch's guard; it must strengthen the latch, never
  weaken it.

## Task detail

### 1 — B47: warn on `helpKey: ''`

`createWhichKey` guards help registration with `if (helpKey)`. `''` is falsy, so
it skips registration and never reaches `parseKey` — no `?` binding, no
diagnostic, indistinguishable from the documented `helpKey: null`.

Distinguish `null` (deliberate, silent, documented) from `''` (almost certainly a
mistake). Warn `[whichkey] invalid helpKey ""; help shortcut disabled.` and leave
`null` untouched. Add the row to `docs/API.md`'s Console warnings table.

### 2 — B45: validate `level` on `register`/`registerGroup`

`level` is public on `ShortcutOptions` and on `registerGroup`'s options, and is
unvalidated. `register('z', fn, { level: -1 })` returns a live unregister
function, lands in the registry, and `getActive('z')` is `undefined` with no
warning — `blockLevel()` floors at 0 and `isReachable` requires
`entry.level >= block`.

Validate exactly as B34 validates `pushLayer`'s level: if supplied and not a
non-negative integer, warn and fall back to **0** (not `nextLevel()` — a
registration has no layer of its own). Reuse B34's message shape. Soft-fail; do
not reject. `NaN` and non-integers are as fatal as negatives. Add the row to the
Console warnings table.

### 3 — B44: hide the popup when a leaf-AND-prefix keystroke taints the buffer

B21 added `if (this.popupVisible && !this.bufferTouchedInput) onShowPopup(...)`
to the leaf-AND-prefix branch. The latch correctly suppresses painting new
characters, but unlike the prefix-only branch it never calls `onHidePopup` — so a
popup showing untainted content stays on screen, stale.

Mirror the prefix-only branch: when `bufferTouchedInput` is latched and
`popupVisible` is true, set `popupVisible = false` and call `onHidePopup()`.

**The repro needs no bare `g` leaf** — `g` alone must be prefix-only, because it
is that branch's timer that sets `popupVisible`. Register `g h` and `g h x`;
press `g` outside a field, then `h` inside one. (An earlier version of this
finding got the configuration wrong; it is corrected in `bughunt.md`.)

### 4 — B15: alias table for special-key bases

`parseKey` passes any multi-character base through verbatim, so `register('escape')`,
`'tab'`, `'up'`, `'esc'`, `'f1'` all succeed and produce canonical strings no
`KeyboardEvent` can ever produce — silently dead.

Add a case-insensitive alias table for known special bases (`SPECIAL_KEYS` plus
`Space` and `F1`–`F12`, with `esc`→`Escape`, `up`/`down`/`left`/`right`→`Arrow*`,
`pgup`/`pgdn`→`PageUp`/`PageDown`) and normalise `base` through it before
`buildCanonical`. For a multi-character base **not** in the table and not
`F1`–`F12`, warn that the key string will never match — **do not throw**, since
exotic `event.key` values must stay bindable.

**The correctness bar:** for every alias, `parseKey(alias)` must equal
`eventToCanonical(<the real event>)`. Test the round trip, not just the mapping.

### 5 — D1: registry `version` counter _(maintainer's chosen direction)_

`ShortcutCheatsheet` calls `engine.getCheatsheetModel()` in its render body, so a
full registry scan plus bucketing plus sorts runs on every re-render. The vanilla
renderer builds the model once at the open transition.

The maintainer chose the **`version` counter** over a `useMemo` keyed on
`visible`, explicitly to preserve freshness — a late registration must still
appear. So:

- Add a monotonic `version` to `ShortcutRegistry`, incremented by **every**
  mutator: `register`, `unregister`, `registerGroup`, `unregisterGroup`,
  `activateLayer`, `deactivateLayer`. Expose it as a read-only accessor.
- `ShortcutCheatsheet` reads `engine.registry.version` during render and
  `useMemo`s the model on it, so the scan recomputes only when the registry
  actually changed.
- **Invalidation must be exhaustive** — grep for every write to `shortcuts`,
  `groups` and `layers` and confirm each bumps. A missed bump means a stale
  cheatsheet, which is worse than the perf cost.
- `version` becomes public API on an exported class → **document it**, and it
  must appear in task 6's sweep.

Do **not** put the model in the snapshot; that would break snapshot immutability.

### 6 — B46: document the remaining public exports

`docs/API.md` is what the README calls "the full reference", and eight exports
never appear in it: `WhichKeyContext`, `LayerContext`, `alphabeticalKeysSort`,
`isModifierOnlyEvent`, `isInputTarget`, `CanonicalKey`, `ShortcutHandler`, and
`SortMode` (plus `WhichKeyPopupLayout`, same shape, judged together).

**Decide documented-or-unexported per symbol rather than defaulting to
documented** — but note unexporting is a `feat!:` break pre-1.0, and the
engine-internals decision-needed marker that would cover such a break is
explicitly out of scope here. So: **document them all in this task**, and where a
symbol looks like it should not be public, say so in the docs entry and leave the
removal to that marker. Include D1's new `version` accessor.

### 7 — D2: `prefers-color-scheme` with author override _(maintainer's chosen direction)_

**RISK: HIGH — RED test in its own commit.**

The shipped theme is dark-only: 15 hardcoded colours, no `@media` rule of any
kind. The maintainer's direction is an `@media (prefers-color-scheme)` rule plus
the ability for an author to override the preference.

**The complication that makes this more than a CSS change.** Both renderers set
the popup's background **inline from JavaScript** — `PANEL_BG_RGB = '17, 24, 39'`
composed into `rgba(17, 24, 39, <opacity>)` and assigned to `style.backgroundColor`
(`src/react/WhichKeyPopup.tsx:13,41,65,93`; `src/vanilla/popup.ts:9,47,52`). An
inline style beats every CSS rule, so a pure-CSS light theme would leave the
popup dark while everything around it turned light. The colour must move into CSS.

Required shape:

- Hoist all 15 colours to `--wk-*` custom properties with **dark as the default**
  (no behaviour change for anyone who does nothing).
- `@media (prefers-color-scheme: light)` supplies the light palette.
- **Author override** via a `[data-wk-theme="light"|"dark"]` attribute that wins
  over the media query in both directions, so an author can force either theme
  regardless of OS preference. Individual `--wk-*` overrides keep working too.
- The popup's runtime opacity stays a prop. Emit **only the opacity** inline as a
  custom property and let CSS compose the colour, so the background follows the
  theme while `backgroundOpacity` still works.

**Sanctioned test updates (this task only).** Seven assertions pin the exact
inline `style.backgroundColor` this change removes:
`src/react/__tests__/WhichKeyPopup.test.tsx:129,146,165,182,315,454` and
`src/vanilla/__tests__/mount.test.ts:218`. Update them to assert the new
mechanism with equal strictness — they must still fail if the opacity prop stops
reaching the element. **Do not weaken them to existence checks.**

Also: any new class or custom property joins the `CONTRACT` array in
`src/__tests__/class-contract.test.tsx` and both doc tables, and the README
Styling section documents the theming contract and the override attribute.

## Definition of done

- All 7 items fixed, one commit each, each stripping its own block (and for D1/D2
  the decision-needed blockquote plus its `User Note`) from `bughunt.md`.
- `bughunt.md` afterwards contains **only**: the preamble with an updated
  "Last triage" line, **B41**, and the **five** remaining decision-needed markers.
- `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check` green.
- Coverage at or above the 80% gate on all four metrics.
- Every new warning appears in `docs/API.md`'s Console warnings table.
- No summary commit — the per-item commits are the audit trail.
