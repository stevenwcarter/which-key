# bughunt.md — code-health audit findings

Last triage: 2026-08-21 against `codehealth/2026-08-21` @ bfbb4cc. B1-B13 executed and stripped 2026-08-21. B14, B16-B40, B42-B43 executed and stripped 2026-08-22 on `codehealth/2026-08-21-batch2`. B15, B44-B47 and two decision-needed markers (the cheatsheet re-render, resolved with a registry `version` counter; and the dark-only theme, resolved with `prefers-color-scheme` plus a `data-wk-theme` override) executed and stripped 2026-08-22 on `codehealth/2026-08-22-batch3`. **Open:** B41, and the five remaining decision-needed markers. Toolchain: npm run build / npm test / npm run lint / npm run format:check.

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

> **decision-needed (API):** library warnings are unconditional, unsilenceable, and shipped verbatim into consumers' production bundles. **Refreshed 2026-08-22** — the original text cited four `console.warn` sites; after three batches there are now **16 diagnostic sites** (15 `console.warn` plus one `console.error` for a throwing consumer handler), all catalogued in `docs/API.md`'s Console warnings table. Three of the four originally-cited files no longer warn directly — `useShortcut`, `useShortcutGroup` and `<WhichKeyLayer>` now route through the shared `warnNoProvider` helper in `src/react/context.ts`. There is still no way to suppress or route any of them: `WhichKeyOptions` has no `onWarn`/`silent` field and `ShortcutRegistry` takes no constructor options. `grep -rn 'NODE_ENV|process.env|import.meta.env' src tsup.config.ts` returns nothing and tsup has no `define`, so the strings ship in every bundle and cannot be dead-code-eliminated. The batches deliberately made warn-never-silently-no-op the house rule, which multiplied the sites fourfold — so this marker's impact has grown, not shrunk. Impact 12 (severity 2 × blast-radius 6, up from 10). The fix adds a public `onWarn` option to `WhichKeyOptions` and `<WhichKeyProvider>` — a public-API addition that should be decided deliberately, not auto-applied.

> **decision-needed (behavioral):** the React renderer does not portal, so `position: fixed` overlays break inside any transformed ancestor. `.wk-popup` and `.wk-backdrop` are `position: fixed` but neither component uses `createPortal`; per CSS spec a `transform`/`filter`/`perspective`/`contain: paint`/`will-change` on any ancestor becomes the containing block for fixed descendants. Any consumer placing `<WhichKeyPopup/>` inside an animated or transformed shell (page-transition wrappers, `translateZ(0)` GPU hints, framer-motion layouts) gets the popup pinned to that box instead of the viewport and the cheatsheet backdrop clipped to it. Impact 9 (severity 3 × blast-radius 3). Portalling to `document.body` changes where nodes land in consumers' DOM and test queries, so confirm before applying.

## Low

### B48. `SPECIAL_KEYS` does double duty as the Shift-retention set and the recognised-name set: `src/engine/keys.ts`

- Category: correctness
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: M
- Risk: medium
- Evidence: found by the batch-3 whole-branch review (2026-08-22). `SPECIAL_KEYS` governs whether `buildCanonical` keeps a `Shift+` prefix, but B15 also used it as "the names this library recognises", so real keys like `Delete` and `Insert` warned that their binding would never match. That symptom is fixed — a separate `KNOWN_BASES` set now gates the warning — but the underlying conflation remains and still produces observable oddities: `Shift+F13` drops Shift while `Shift+F1` keeps it (`buildCanonical`'s function-key test is `/^F([1-9]|1[0-2])$/`, so F13-F24 are not treated as function keys), and `Ctrl+Shift+Delete` canonicalizes identically to `Ctrl+Delete` because `Delete` is deliberately absent from `SPECIAL_KEYS`. Adding the missing names to `SPECIAL_KEYS` would fix the Shift handling but silently change existing canonical strings, which is why batch 3 explicitly did not.
- Blast radius: src/engine/keys.ts (`SPECIAL_KEYS`, `KNOWN_BASES`, `buildCanonical`'s `isSpecial` and function-key tests)
- Proposed fix: separate the two concerns explicitly — one set for "this is a named key, not a character" (drives Shift retention) and one for "this is a name we recognise" (drives the warning), with the first a subset of the second only where Shift retention is genuinely wanted. Changing Shift retention for any existing key is a breaking change to canonical strings, so pair this with a `feat!:` bump or a documented migration.
- [ ] execute [ ] skip

### B49. The vanilla cheatsheet never refreshes while open, so a late registration is invisible there: `mountWhichKey.render` (src/vanilla/mount.ts)

- Category: correctness
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: found by the batch-3 whole-branch review (2026-08-22). The vanilla renderer builds the cheatsheet model once at the closed-to-open transition and never rebuilds it; the React renderer, since D1, memoises on `registry.version` and so picks up a registration made while the sheet is open. The divergence predates D1 — D1 preserved it rather than creating it, because the maintainer chose the version counter specifically to keep React fresh — but it is now asymmetric and documented on the React side only. A consumer who registers a shortcut from an async load, or from a component that mounts behind the open sheet, sees it in React and not in vanilla.
- Blast radius: src/vanilla/mount.ts (the cheatsheet open transition); src/react/ShortcutCheatsheet.tsx (the reference behaviour); src/engine/registry.ts (`version`)
- Proposed fix: give the vanilla renderer the same freshness rule — track the last-rendered `registry.version` alongside `cheatsheetNode` and rebuild the panel's contents when it changes while the sheet is open. Reuse `renderCheatsheet`'s existing destroy/rebuild path rather than diffing, and keep focus on the panel across the rebuild so the focus trap is not broken.
- [ ] execute [ ] skip

### B41. CI job runs an unpinned third-party action while holding CODECOV_TOKEN under a default-scoped GITHUB_TOKEN: build job (.github/workflows/ci.yml:20)

- Category: security
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: the workflow declares no `permissions:` block at either level, so `GITHUB_TOKEN` inherits the repository default — read-write `contents` on many repos, letting any step push commits or create releases. In the same job `codecov/codecov-action@v5` is referenced by a mutable major tag rather than a commit SHA and is handed `secrets.CODECOV_TOKEN`; `v5` is a moving pointer the upstream owner can retarget, so a compromised or retagged release executes with the Codecov token in env and the ambient default-scoped `GITHUB_TOKEN` on `push: [main]` runs. Fork `pull_request` runs are already forced read-only by GitHub, so write exposure is limited to same-repo pushes. No hardcoded credentials exist anywhere in the repo — this is the only credential-handling surface.
- Blast radius: .github/workflows/ci.yml:2,7,20,22
- Proposed fix: add a top-level `permissions:\n  contents: read` block after `on:` (no step needs write), and pin the third-party action to a full commit SHA with a trailing version comment: `uses: codecov/codecov-action@<40-char-sha> # v5.x.x`. The first-party `actions/checkout@v4` and `actions/setup-node@v4` may stay on tags.
- [ ] execute [ ] skip

> **decision-needed (architectural):** `<WhichKeyLayer>` derives its level from React tree depth (`parent.level + 1`, src/react/WhichKeyLayer.tsx:12), so two sibling layers under the same parent both activate the same level. Confirmed at the engine level: with two exclusive layers at level 1, `blockLevel()` is 1 and `isReachable` uses `entry.level >= block`, so the base shortcut is correctly blocked but each exclusive sibling's shortcuts remain fully reachable from the other — two simultaneously-mounted exclusive modals do not isolate from each other. Impact 4 (severity 2 × blast-radius 2). The fix (allocate per layer instance via `engine.pushLayer` and publish `handle.level` through context as state) changes the level a child sees between first render and post-effect render — a real behavioral change. Decide whether sibling isolation is wanted at all.

> **decision-needed (public-API break):** engine internals `Matcher`, `MatcherOptions`, `ShortcutRegistry` and `resolveSort` are part of the published surface (`src/engine/index.ts`, re-exported through `which-key/react`). **Refreshed 2026-08-22** — the original text said these "appear nowhere in docs/API.md"; that is no longer strictly true, since documenting the debugging predicates introduced an incidental `Matcher.handleKeyDown` mention. None of the four has a documented signature or type block, so the substance stands: any refactor of the matching loop or sort resolver is a breaking change for whoever reached for them. `ShortcutRegistry` is doubly exposed via `engine.registry`, which the reference describes as advanced-use-only while the class exposes fully mutating `register`/`unregister`/`activateLayer` — and which now also carries the public `version` accessor added for the cheatsheet memo. `export * from './types'` also publishes the internal `ShortcutEntry`/`GroupEntry` shapes. Impact 2 (severity 1 × blast-radius 2). Removing them requires a `feat!:` bump; the alternative is documenting them under an explicit "Advanced / unstable" heading. Decide before the 1.0 cut.

## Skip (do not re-flag in future runs)

_(none yet)_
