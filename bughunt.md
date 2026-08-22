# bughunt.md — code-health audit findings

Last triage: 2026-08-21 against `codehealth/2026-08-21` @ bfbb4cc. B1-B13 executed and stripped 2026-08-21. B14, B16-B40, B42-B43 executed and stripped 2026-08-22 on `codehealth/2026-08-21-batch2`. **Open:** B15 and B41 (left unchecked by the user in that batch); B44, B45 and B46 (found during that batch's reviews, never triaged); and the 7 decision-needed markers. Toolchain: npm run build / npm test / npm run lint.

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

> **decision-needed (behavioral):** the cheatsheet overlay is not modal — `toggleCheatsheet`/`openCheatsheet` only flip `cheatsheetVisible` and `Matcher.handleKeyDown` never consults it, so while the full-screen sheet covers the app, pressing `s` still fires the page's Save shortcut and `g` pops the leader popup over the backdrop. Additionally both Escape-to-close listeners (src/react/ShortcutCheatsheet.tsx:20, src/vanilla/mount.ts:27) are on `document` and neither `preventDefault`s nor `stopPropagation`s, so with the README's own layer example (`useShortcut('Escape', onClose)`, README.md:167) one Escape press closes the cheatsheet **and** the user's modal (confirmed empirically). Impact 12 (severity 3 × blast-radius 4). The correct fix — making the cheatsheet an engine-level exclusive layer and routing its Escape through a real global shortcut — changes dispatch semantics for anyone relying on shortcuts working behind the cheatsheet, and touches both renderers. Discuss scope before scheduling.

## Medium

### B15. Lowercase or aliased special-key names register silently dead bindings: `parseKey` (src/engine/keys.ts:105)
- Category: correctness
- Impact: 9 (severity 3 × blast-radius 3)
- Effort: M
- Risk: medium
- Evidence: empirically confirmed. `parseKey` passes any multi-character base through verbatim, so `register('escape')`, `'tab'`, `'enter'`, `'space'`, `'up'`, `'esc'`, `'backspace'`, `'f1'` all succeed and produce canonical strings no KeyboardEvent can ever produce. Firing every corresponding real key gave `{"escape":0,"tab":0,"enter":0,"space":0,"up":0,"ArrowUp":1,"Escape":1,"esc":0,"f1":0,"F1":1}` — only exactly-cased names fire. Because `parseKey` happily throws on an unknown *modifier*, a consumer reasonably assumes bad key strings are validated; this failure is completely silent. No test covers an unrecognized base.
- Blast radius: src/engine/keys.ts:3,105,112; src/engine/controller.ts:136,156; src/react/useShortcut.ts:22
- Proposed fix: add a case-insensitive alias table for known special bases (SPECIAL_KEYS plus `Space` and `F1`-`F12`, with `esc`→`Escape`, `up`/`down`/`left`/`right`→`Arrow*`, `pgup`/`pgdn`→`PageUp`/`PageDown`) and normalize `base` through it before `buildCanonical`. For a multi-character base not in the table and not `F1`-`F12`, `console.warn` that the key string will never match — do not throw, since exotic `event.key` values should stay bindable.
- [ ] execute   [ ] skip

### B46. Eight public exports are absent from docs/API.md, which the README calls "the full reference": `src/engine/index.ts` / `src/react/index.ts`
- Category: api-surface
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: M
- Risk: low
- Evidence: found during B16's export cross-check (2026-08-21), not by the original triage. CLAUDE.md states the rule: "Anything public must be added to the relevant `index.ts` *and* to `docs/API.md`." B16 documented the layers API and B28 documents the canonicalization helpers, but a full sweep of the three entry points still leaves these exported and undocumented: `WhichKeyContext` and `LayerContext` (src/react/index.ts:3), `alphabeticalKeysSort` (src/engine/index.ts:6), `isModifierOnlyEvent` and `isInputTarget` (src/engine/index.ts:2), and the `CanonicalKey` / `ShortcutHandler` types published by `export * from './types'`. (`parseSequence` was on the raw list but B28 documents it.) B16's review additionally surfaced `SortMode` — also published by `export * from './types'` and never named in docs/API.md, though its expanded union appears inline in the `sortKeys` row; `WhichKeyPopupLayout` is the same shape and was judged not worth flagging, so treat these two together when deciding. These are distinct from the separate decision-needed marker below, which covers `Matcher`, `MatcherOptions`, `ShortcutRegistry`, `resolveSort` and the internal `ShortcutEntry`/`GroupEntry` shapes — none of the eight above appear there.
- Blast radius: docs/API.md; src/engine/index.ts:2,6; src/react/index.ts:3; src/engine/types.ts:1,3
- Proposed fix: for each, decide documented-or-unexported rather than defaulting to documented. `WhichKeyContext`/`LayerContext` are plausibly genuine escape hatches for advanced consumers and want a short section; `isModifierOnlyEvent`/`isInputTarget` are matcher-internal predicates that may be better unexported; `alphabeticalKeysSort` pairs naturally with the existing `sortKeys` docs; `CanonicalKey` and `ShortcutHandler` appear in documented signatures and want type blocks. Unexporting any of them is a `feat!:` break while pre-1.0, so pair this with the existing public-surface decision-needed marker.
- [ ] execute   [ ] skip

### B47. `helpKey: ''` silently disables the help shortcut with no warning — the only silent no-op left: `createWhichKey` (src/engine/controller.ts)
- Category: api-surface
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: low
- Evidence: surfaced by B23's review and promoted by the final whole-branch review (2026-08-22). `createWhichKey` guards its help registration with `if (helpKey)`. `''` is falsy, so an empty string skips registration entirely and never reaches `parseKey` — the consumer gets no `?` binding and no diagnostic, identical to the documented `helpKey: null`. This predates the B14-B43 batch and was correctly outside B23's scope (B23 covered values that *throw*, and `''` does not). It matters now because that batch made "warn, never silently no-op" the house rule across six other paths — `register`, `registerGroup`, `helpKey` (unparseable), `timeoutMs`, `pushLayer` level, `classPrefix`, and duplicate `mountWhichKey` all warn on invalid input. `helpKey: ''` is now the sole invalid-input path in the library that fails silently, which is exactly the inconsistency a consumer will trip over.
- Blast radius: src/engine/controller.ts (the `if (helpKey)` guard); docs/API.md (the `helpKey` row and the Console warnings table)
- Proposed fix: distinguish `null` (documented, deliberate, silent) from `''` (almost certainly a mistake). Warn for the empty string using the established shape — `[whichkey] invalid helpKey ""; help shortcut disabled.` — and leave `null` untouched. Add the row to docs/API.md's Console warnings table.
- [ ] execute   [ ] skip

### B45. An explicit negative `level` on register()/registerGroup() silently makes the shortcut unreachable: `ShortcutOptions.level` (src/engine/types.ts)
- Category: api-surface
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: found during B34's review (2026-08-21), not by the original triage. B34 closed this hole for `pushLayer({ level })`, but `level` is also a public field on `ShortcutOptions` (and on `registerGroup`'s options), and that path is still unvalidated. Verified empirically against the built bundle: `register('z', fn, { level: -1 })` returns a live unregister function, the entry lands in the registry, and `registry.getActive('z')` is `undefined` with **no warning** — because `blockLevel()` floors at 0 and `isReachable` requires `entry.global || entry.level >= block`. Same silent-dead-shortcut failure B34 describes, at a different public entry point. Two neighbouring paths were probed and are NOT affected: `pushLayer({ level: -1 })` now warns and falls back (B34), and `activateLayer(-1, true)` is inert — it creates a layer that both `nextLevel()` and `blockLevel()` ignore, and registers nothing at that level, so no shortcut becomes unreachable through it. Note B16/Task 25 will document `level` as a public option, which makes shipping it unvalidated more visible.
- Blast radius: src/engine/types.ts (`ShortcutOptions.level`); src/engine/controller.ts (`register`, `registerGroup`); src/engine/registry.ts (`isReachable`, `blockLevel`)
- Proposed fix: validate `opts.level` in `register`/`registerGroup` the same way B34 validates `pushLayer`'s — if supplied and not a non-negative integer, `console.warn` and fall back to `0`. Reuse B34's message shape. Do NOT reject the value outright; soft-fail per the batch convention.
- [ ] execute   [ ] skip

> **decision-needed (API):** library warnings are unconditional, unsilenceable, and shipped verbatim into consumers' production bundles. There are four `console.warn` sites (src/engine/registry.ts:39, src/react/useShortcut.ts:19, src/react/useShortcutGroup.ts:12, src/react/WhichKeyLayer.tsx:15) and no way to suppress or route any of them — `WhichKeyOptions` has no `onWarn`/`silent` field and `ShortcutRegistry` takes no constructor options. `grep -rn 'NODE_ENV|process.env|import.meta.env' src tsup.config.ts` returns nothing and tsup has no `define`, so the strings ship in every bundle and cannot be dead-code-eliminated. Combined with B8, a production app that mounts one modal layer writes to the end user's console on every mount. Impact 10 (severity 2 × blast-radius 5). The fix adds a public `onWarn` option to `WhichKeyOptions` and `<WhichKeyProvider>` — a public-API addition that should be decided deliberately, not auto-applied.

> **decision-needed (behavioral):** the React renderer does not portal, so `position: fixed` overlays break inside any transformed ancestor. `.wk-popup` and `.wk-backdrop` are `position: fixed` but neither component uses `createPortal`; per CSS spec a `transform`/`filter`/`perspective`/`contain: paint`/`will-change` on any ancestor becomes the containing block for fixed descendants. Any consumer placing `<WhichKeyPopup/>` inside an animated or transformed shell (page-transition wrappers, `translateZ(0)` GPU hints, framer-motion layouts) gets the popup pinned to that box instead of the viewport and the cheatsheet backdrop clipped to it. Impact 9 (severity 3 × blast-radius 3). Portalling to `document.body` changes where nodes land in consumers' DOM and test queries, so confirm before applying.

## Low

### B44. A tainted leaf-AND-prefix keystroke leaves the popup visible-but-stale with no hide: `Matcher.handleKeyDown` (src/engine/matcher.ts, leaf-AND-prefix branch)
- Category: correctness
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: found during B21's review (2026-08-21), not by the original triage. B21 added an input-echo-latched popup refresh to the leaf-AND-prefix branch: `if (this.popupVisible && !this.bufferTouchedInput) onShowPopup(...)`. The latch correctly suppresses painting newly-tainted characters, but unlike the prefix-only branch — which hides an already-visible popup when the buffer becomes tainted — the leaf-AND-prefix branch never calls `onHidePopup`. So a popup showing untainted content stays on screen, stale, after a tainted keystroke. Verified by trace: with `g h` and `g h x` registered (no bare `g` leaf — `g` alone is prefix-only, and it is that branch's timer that sets `popupVisible`), pressing `g` outside a field then `h` inside one leaves `['g']` displayed with no hide call; extending the chain with `g h x y` shows the same stale window widen by one level per additional leaf-AND-prefix hop. **No disclosure** — the stale content was already on screen before the taint, and the latch still blocks the new characters. The window is bounded only incidentally, by (depth of the app's leaf-AND-prefix chain) × `timeoutMs`, since every terminal outcome eventually reaches `resetBuffer`; it is not a designed bound. A two-level chain already defeats the "the next keystroke will hide it" assumption.
- Blast radius: src/engine/matcher.ts (leaf-AND-prefix branch, prefix-only branch's hide at the `bufferTouchedInput` guard, `resetBuffer`)
- Proposed fix: mirror the prefix-only branch — when `this.bufferTouchedInput` is latched and `this.popupVisible` is true, set `popupVisible = false` and call `onHidePopup()` instead of merely skipping the refresh, so both branches share the same safety property rather than relying on eventual termination. Add a test registering a two-level leaf-AND-prefix chain and asserting the hide fires.
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

> **decision-needed (behavioral):** `ShortcutCheatsheet` rebuilds the whole cheatsheet model in the render body on every re-render (src/react/ShortcutCheatsheet.tsx:26) — `getCheatsheetModel()` runs a full registry scan, a bucketing pass and up to 2+G sorts, and the component re-renders on every emit (since B5, emits fire only on real state changes rather than on every keystroke). The vanilla renderer does not have this problem: mount.ts:41 builds the model once at the open transition. Impact 4 (severity 2 × blast-radius 2). The two fixes trade off differently — a `useMemo` keyed on `visible` matches vanilla's semantics but makes the sheet a snapshot of open-time (late registrations won't appear), while a registry `version` counter preserves freshness but adds a member to `ShortcutRegistry`. Pick the semantics before applying.

> **decision-needed (architectural):** `<WhichKeyLayer>` derives its level from React tree depth (`parent.level + 1`, src/react/WhichKeyLayer.tsx:12), so two sibling layers under the same parent both activate the same level. Confirmed at the engine level: with two exclusive layers at level 1, `blockLevel()` is 1 and `isReachable` uses `entry.level >= block`, so the base shortcut is correctly blocked but each exclusive sibling's shortcuts remain fully reachable from the other — two simultaneously-mounted exclusive modals do not isolate from each other. Impact 4 (severity 2 × blast-radius 2). The fix (allocate per layer instance via `engine.pushLayer` and publish `handle.level` through context as state) changes the level a child sees between first render and post-effect render — a real behavioral change. Decide whether sibling isolation is wanted at all.

> **decision-needed (API):** the shipped theme is dark-only with all 15 colours hardcoded and no custom-property hook (src/styles.css). There is no `@media` rule of any kind — no `prefers-color-scheme` (and correspondingly no `prefers-reduced-motion`, which is harmless since the sheet declares zero transitions). Contrast within the popup is fine, so this is not a legibility defect; the cost is that a light-themed app gets a dark slab and a consumer wanting a light variant must out-specify ~15 rules. Impact 3 (severity 1 × blast-radius 3). Hoisting the palette to `--wk-*` custom properties is a theming-API commitment; the zero-cost alternative is simply documenting "the prebuilt stylesheet is a dark theme" in the README Styling section. Decide which.

> **decision-needed (public-API break):** engine internals `Matcher`, `MatcherOptions`, `ShortcutRegistry` and `resolveSort` are part of the published surface (src/engine/index.ts:3-7, re-exported through `which-key/react`). `Matcher`, `MatcherOptions` and `resolveSort` appear nowhere in docs/API.md — undocumented but publicly importable, so any refactor of the matching loop or sort resolver is a breaking change for whoever reached for them. `ShortcutRegistry` is doubly exposed via `engine.registry`, which docs/API.md:144 calls a "Read-only reference" while the class exposes fully mutating `register`/`unregister`/`activateLayer`. `export * from './types'` also publishes the internal `ShortcutEntry`/`GroupEntry` shapes. Impact 2 (severity 1 × blast-radius 2). Removing them requires a `feat!:` bump; the alternative is documenting them under an explicit "Advanced / unstable" heading. Decide before the 1.0 cut.

## Skip (do not re-flag in future runs)
_(none yet)_
