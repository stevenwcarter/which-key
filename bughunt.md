# bughunt.md — code-health audit findings

Last triage: 2026-08-21 against `codehealth/2026-08-21` @ bfbb4cc. B1-B13 executed and stripped 2026-08-21; B14-B43 and the 7 decision-needed markers remain open. Toolchain: npm run build / npm test / npm run lint.

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

### B16. docs/API.md omits the entire layers API it claims to fully document: `WhichKeyEngine` (docs/API.md:53)
- Category: api-surface
- Impact: 9 (severity 3 × blast-radius 3)
- Effort: M
- Risk: low
- Evidence: README.md:254 calls docs/API.md "the full reference". The `WhichKeyEngine` section (53-144) documents register/registerGroup/start/stop/subscribe/getSnapshot/cheatsheet methods/cancel/registry — but not `pushLayer` or `activateLayer`. The React section (194-287) and its table of contents omit `<WhichKeyLayer>` and `WhichKeyLayerProps` entirely, though both are exported from src/react/index.ts:4-5. Further drift in the same file: the `ShortcutOptions` table (73-80) omits the real `global` and `level` options (types.ts:10-11); the `registerGroup` options table (90-95) omits `level`; and the `popup` default is listed as `{}` (322) when the real defaults are `{layout:'vertical', maxRows:5, backgroundOpacity:0.95}`. A consumer reading only the reference cannot discover layers at all.
- Blast radius: docs/API.md:15,53,73,90,194,322; src/engine/controller.ts:37; src/react/WhichKeyLayer.tsx:9
- Proposed fix: add `engine.pushLayer(options?)` and `engine.activateLayer(level, exclusive)` sections plus a `LayerHandle` type block to the engine section; add a `<WhichKeyLayer>` section and TOC entry to the React section; add `global`/`level` rows to the ShortcutOptions table, `level` to the registerGroup table, and correct the `popup` default. Docs-only.
- [x] execute   [ ] skip

### B45. An explicit negative `level` on register()/registerGroup() silently makes the shortcut unreachable: `ShortcutOptions.level` (src/engine/types.ts)
- Category: api-surface
- Impact: 6 (severity 3 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: found during B34's review (2026-08-21), not by the original triage. B34 closed this hole for `pushLayer({ level })`, but `level` is also a public field on `ShortcutOptions` (and on `registerGroup`'s options), and that path is still unvalidated. Verified empirically against the built bundle: `register('z', fn, { level: -1 })` returns a live unregister function, the entry lands in the registry, and `registry.getActive('z')` is `undefined` with **no warning** — because `blockLevel()` floors at 0 and `isReachable` requires `entry.global || entry.level >= block`. Same silent-dead-shortcut failure B34 describes, at a different public entry point. Two neighbouring paths were probed and are NOT affected: `pushLayer({ level: -1 })` now warns and falls back (B34), and `activateLayer(-1, true)` is inert — it creates a layer that both `nextLevel()` and `blockLevel()` ignore, and registers nothing at that level, so no shortcut becomes unreachable through it. Note B16/Task 25 will document `level` as a public option, which makes shipping it unvalidated more visible.
- Blast radius: src/engine/types.ts (`ShortcutOptions.level`); src/engine/controller.ts (`register`, `registerGroup`); src/engine/registry.ts (`isReachable`, `blockLevel`)
- Proposed fix: validate `opts.level` in `register`/`registerGroup` the same way B34 validates `pushLayer`'s — if supplied and not a non-negative integer, `console.warn` and fall back to `0`. Reuse B34's message shape. Do NOT reject the value outright; soft-fail per the batch convention.
- [ ] execute   [ ] skip

### B25. PopupOptions is documented as a public type but is not exported from which-key/vanilla: `PopupOptions` (src/vanilla/index.ts:2)
- Category: api-surface
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: docs/API.md:322 types the `popup` option as `Partial<PopupOptions> | false` and :327 gives `PopupOptions` its own table, but src/vanilla/index.ts only re-exports `mountWhichKey` and `MountOptions`. Confirmed in the shipped declarations: `dist/vanilla/index.d.ts` *declares* `type PopupOptions` (it must, since `MountOptions` references it) but the terminal export list leaves it unnamed. A consumer writing `function popupCfg(): Partial<PopupOptions>` cannot import the type and must retype it by hand. Same gap: `mountWhichKey`'s return is an inline anonymous `{ unmount(): void }` with no exported alias, so a consumer cannot annotate the handle they hold.
- Blast radius: src/vanilla/index.ts:2; src/vanilla/popup.ts:3; src/vanilla/mount.ts:6,14; docs/API.md:322,327
- Proposed fix: add `export type { PopupOptions } from './popup';` to src/vanilla/index.ts and export a named `WhichKeyMountHandle = { unmount(): void }` from mount.ts, using it as `mountWhichKey`'s declared return type. Both additive — existing structural usage keeps compiling.
- [x] execute   [ ] skip

### B26. Hardcoded `z-index: 50` with no override hook puts the overlay under most host-app modal layers: `styles.css` (src/styles.css:16)
- Category: frontend
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: high
- Evidence: `.wk-popup` (:16) and `.wk-backdrop` (:40) both use a literal `z-index: 50`. This library renders *over* someone else's app, but 50 is below the stacking layer every major UI kit uses for modals (Bootstrap `.modal` 1055, MUI modal 1300, Ant Design 1000). A consumer who presses `?` while any such dialog is open gets the cheatsheet rendered behind it and unreachable. Because both which-key layers use the identical value, DOM order alone decides popup-vs-backdrop ordering, which is what makes the B18 divergence observable. There is no CSS custom property, so overriding requires out-specifying two selectors from the shipped sheet.
- Blast radius: src/styles.css:16,40; README.md:218; examples/vanilla/index.html:30
- Proposed fix: replace both literals with `z-index: var(--wk-z-index, 1000);` and `z-index: var(--wk-z-index-backdrop, var(--wk-z-index, 1000));`, and document the two variables in the README Styling section.
- [x] execute   [ ] skip

### B28. The debugging exports that answer "why doesn't my shortcut fire" are undocumented: `parseKey` / `eventToCanonical` / `registry` (docs/API.md:142)
- Category: observability
- Impact: 6 (severity 2 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: the three things that silently kill a shortcut — canonicalization mismatch (B2, B15), an exclusive layer raising `blockLevel`, and a higher-level entry winning `findActive` — are all unobservable from the public API. docs/API.md:142-144 documents `engine.registry` as nothing more than "Read-only reference to the underlying ShortcutRegistry. Advanced use only." with no members listed, so a developer cannot tell whether `getAllActive()` is supported or internal. Meanwhile `parseKey` and `eventToCanonical` **are** already exported from src/engine/index.ts:2 and re-exported through `which-key/react` — and are exactly the tool needed to diagnose B2, since `parseKey('Shift+/')` immediately reveals the `/` mismatch — but neither appears anywhere in docs/API.md or README.md, so nobody knows they exist.
- Blast radius: docs/API.md:142,337; src/engine/index.ts:2; src/react/index.ts:13; src/engine/registry.ts:22,78,140
- Proposed fix: document the already-exported `parseKey(keys)` / `parseSequence(keys)` / `eventToCanonical(event)` in docs/API.md under a short "Debugging" heading with the canonical-form-inspection recipe, and document `registry.getAllActive()` as the supported way to list live bindings. Zero-risk, docs-only. (A richer `registry.explain(keys)` returning why a binding is unreachable is a new public method — out of scope here.)
- [x] execute   [ ] skip

> **decision-needed (API):** library warnings are unconditional, unsilenceable, and shipped verbatim into consumers' production bundles. There are four `console.warn` sites (src/engine/registry.ts:39, src/react/useShortcut.ts:19, src/react/useShortcutGroup.ts:12, src/react/WhichKeyLayer.tsx:15) and no way to suppress or route any of them — `WhichKeyOptions` has no `onWarn`/`silent` field and `ShortcutRegistry` takes no constructor options. `grep -rn 'NODE_ENV|process.env|import.meta.env' src tsup.config.ts` returns nothing and tsup has no `define`, so the strings ship in every bundle and cannot be dead-code-eliminated. Combined with B8, a production app that mounts one modal layer writes to the end user's console on every mount. Impact 10 (severity 2 × blast-radius 5). The fix adds a public `onWarn` option to `WhichKeyOptions` and `<WhichKeyProvider>` — a public-API addition that should be decided deliberately, not auto-applied.

> **decision-needed (behavioral):** the React renderer does not portal, so `position: fixed` overlays break inside any transformed ancestor. `.wk-popup` and `.wk-backdrop` are `position: fixed` but neither component uses `createPortal`; per CSS spec a `transform`/`filter`/`perspective`/`contain: paint`/`will-change` on any ancestor becomes the containing block for fixed descendants. Any consumer placing `<WhichKeyPopup/>` inside an animated or transformed shell (page-transition wrappers, `translateZ(0)` GPU hints, framer-motion layouts) gets the popup pinned to that box instead of the viewport and the cheatsheet backdrop clipped to it. Impact 9 (severity 3 × blast-radius 3). Portalling to `document.body` changes where nodes land in consumers' DOM and test queries, so confirm before applying.

## Low

### B44. A tainted leaf-AND-prefix keystroke leaves the popup visible-but-stale with no hide: `Matcher.handleKeyDown` (src/engine/matcher.ts, leaf-AND-prefix branch)
- Category: correctness
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: found during B21's review (2026-08-21), not by the original triage. B21 added an input-echo-latched popup refresh to the leaf-AND-prefix branch: `if (this.popupVisible && !this.bufferTouchedInput) onShowPopup(...)`. The latch correctly suppresses painting newly-tainted characters, but unlike the prefix-only branch — which hides an already-visible popup when the buffer becomes tainted — the leaf-AND-prefix branch never calls `onHidePopup`. So a popup showing untainted content stays on screen, stale, after a tainted keystroke. Verified by trace: with `g`, `g h`, `g h x` all registered (each a leaf and a prefix), pressing `g` outside a field then `h` inside one leaves `['g']` displayed with no hide call. **No disclosure** — the stale content was already on screen before the taint, and the latch still blocks the new characters. The window is bounded only incidentally, by (depth of the app's leaf-AND-prefix chain) × `timeoutMs`, since every terminal outcome eventually reaches `resetBuffer`; it is not a designed bound. A two-level chain already defeats the "the next keystroke will hide it" assumption.
- Blast radius: src/engine/matcher.ts (leaf-AND-prefix branch, prefix-only branch's hide at the `bufferTouchedInput` guard, `resetBuffer`)
- Proposed fix: mirror the prefix-only branch — when `this.bufferTouchedInput` is latched and `this.popupVisible` is true, set `popupVisible = false` and call `onHidePopup()` instead of merely skipping the refresh, so both branches share the same safety property rather than relying on eventual termination. Add a test registering a two-level leaf-AND-prefix chain and asserting the hide fires.
- [ ] execute   [ ] skip

### B32. mountWhichKey has no double-mount guard, so two calls silently duplicate the popup DOM: `mountWhichKey` (src/vanilla/mount.ts:12)
- Category: api-surface
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: high
- Evidence: nothing tracks whether an engine or container already has a renderer attached. Calling `mountWhichKey(wk)` twice — a hot-reload re-run, a component that mounts on route change without unmounting, two modules wiring the same engine — yields two subscriptions and two nodes appended to `document.body`, both carrying `data-testid="whichkey-popup"` and `role="dialog" aria-label="Keyboard shortcuts"`. Two same-labelled dialogs is an a11y defect, the escape listener is registered twice, and the first `unmount()` leaves the second renderer live. mount.ts:32 and :59 are uncovered and mount.test.ts has no double-mount case.
- Blast radius: src/vanilla/mount.ts:12,15,52,56; src/vanilla/popup.ts:42,46
- Proposed fix: keep a module-level `WeakSet<HTMLElement>` of containers with a live mount; on a repeat mount `console.warn('[whichkey] mountWhichKey called twice for the same container; the previous mount is still active')`. Make `unmount()` idempotent by clearing the entry. Return type unchanged.
- [x] execute   [ ] skip

### B33. classPrefix silently opts the consumer out of the shipped stylesheet, undocumented: `mountWhichKey` (src/vanilla/mount.ts:18)
- Category: frontend
- Impact: 4 (severity 2 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: `classPrefix` threads correctly through every vanilla class (verified: all 23 class writes use the `${p}-` template, none hardcoded), but src/styles.css hardcodes `.wk-*` in all 24 selectors. So `mountWhichKey(wk, { classPrefix: 'myapp' })` plus the README's own `import 'which-key/styles.css'` yields a completely unstyled overlay: the backdrop loses `position:fixed; inset:0`, the popup loses `position:fixed`, and both render inline in the body flow. README.md:243-247 shows the two side by side with no warning they are mutually exclusive; the only hint is docs/API.md:386. Separately the React renderer hardcodes `wk-` in all 18 className literals with no prop to change it.
- Blast radius: src/vanilla/mount.ts:18; src/vanilla/popup.ts:10; src/vanilla/cheatsheet.ts:5; src/styles.css:2; README.md:243; docs/API.md:325,386
- Proposed fix: add an explicit note at README.md:243 and docs/API.md:325 — "Using `classPrefix` opts out of `which-key/styles.css` entirely; you must supply your own stylesheet for the whole class contract." Also state that `classPrefix` is vanilla-only and the React components always emit `wk-`.
- [x] execute   [ ] skip

### B35. No troubleshooting section documenting the emitted warnings or the silent failure modes: `README.md` (README.md:252)
- Category: observability
- Impact: 3 (severity 1 × blast-radius 3)
- Effort: S
- Risk: low
- Evidence: neither README.md nor docs/API.md mentions the string `[whichkey]` or the word "warn" anywhere. A developer who sees `[whichkey] Shortcut "j" registered while another is active…` has no documentation telling them whether it is expected (it is, for the layer pattern the same README teaches). Symmetrically, the failure modes that produce no output at all — a key string that canonicalizes differently than the runtime event (B2, B15), a binding shadowed by an exclusive layer, a shortcut suppressed because focus is in an input — are never listed together as things to check. For a library whose entire failure mode is "nothing happens", this is the difference between a five-minute fix and an abandoned integration.
- Blast radius: README.md:252; docs/API.md:337; src/engine/matcher.ts:43; src/engine/controller.ts:159
- Proposed fix: add a `## Troubleshooting` section to README.md with a checklist — (1) is `<WhichKeyProvider>` an ancestor / did you call `engine.start()`; (2) is focus in an input — set `enableOnInputs: true`; (3) compare `parseKey('<your key>')` against `eventToCanonical(e)` from a raw keydown listener; (4) is an exclusive layer active — use `global: true`; (5) is another registration winning — check level then priority. Add a matching subsection to docs/API.md listing each warning verbatim with its meaning.
- [x] execute   [ ] skip

### B36. classPrefix is interpolated into className with no validation, so a prefix with spaces splits the class: `MountOptions.classPrefix` (src/vanilla/mount.ts:16)
- Category: api-surface
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: medium
- Evidence: `const prefix = opts.classPrefix ?? 'wk';` is interpolated raw into every className. A prefix containing a space (`'my app'`) produces `class="my app-popup my app-popup--vertical"` — four unrelated classes, none matching the consumer's stylesheet, so the popup renders completely unstyled with no diagnostic. Prefixes starting with a digit or containing `.`/`#`/`:` produce classes that are valid HTML but unselectable without escaping, so `.1x-popup { … }` silently never applies. docs/API.md:325 and README.md:243 advertise the option with no stated constraint.
- Blast radius: src/vanilla/mount.ts:16; src/vanilla/popup.ts:11,17,44; src/vanilla/cheatsheet.ts:5,12; docs/API.md:325; README.md:243
- Proposed fix: validate against `/^-?[A-Za-z_][A-Za-z0-9_-]*$/`; on failure `console.warn('[whichkey] invalid classPrefix "…"; falling back to "wk"')` and use `'wk'`. Document the constraint in docs/API.md:325.
- [x] execute   [ ] skip

### B39. Vanilla example styles a class the renderer never emits, so the demo cheatsheet renders broken: inline stylesheet (examples/vanilla/index.html:52)
- Category: frontend
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: the inline demo CSS defines `.wk-cheatsheet__panel` (line 52) — a class no renderer emits — and styles `.wk-cheatsheet` (line 46) as the full-screen overlay. The actual markup is `.wk-backdrop > .wk-cheatsheet`, and `.wk-backdrop` gets no rule at all, so pressing `?` in this demo produces an unpositioned backdrop in normal flow containing a full-viewport black box with top-left-aligned unstyled text. Two smaller defects in the same file: line 42 adds `content: '+'` via `::before` on `.wk-row--group .wk-row__label` but the renderer already prepends `+` to the label text, so group rows show `++`; and lines 108-109 pin `which-key@0.1.0` from unpkg while package.json is at 0.1.1. Unpublished and eslint-ignored, but it is the copy-paste starting point the file advertises.
- Blast radius: examples/vanilla/index.html:42,46,52,108,109; src/vanilla/cheatsheet.ts:26; src/vanilla/popup.ts:22
- Proposed fix: rename `.wk-cheatsheet` → `.wk-backdrop` and `.wk-cheatsheet__panel` → `.wk-cheatsheet` in the inline `<style>`, delete the `::before { content: '+' }` rule at line 42, and change the two unpkg specifiers to `which-key@latest`.
- [x] execute   [ ] skip

### B40. wk-cheatsheet__section is emitted by both renderers but has no rule in the shipped stylesheet: `styles.css` (src/styles.css:50)
- Category: frontend
- Impact: 2 (severity 1 × blast-radius 2)
- Effort: S
- Risk: medium
- Evidence: mechanical diff of emitted vs. defined classes — both ShortcutCheatsheet.tsx:44 and vanilla/cheatsheet.ts:51 emit `wk-cheatsheet__section` on the per-group `<section>`, but src/styles.css has no `.wk-cheatsheet__section` selector (it defines the plural `.wk-cheatsheet__sections` container at :49 and every other cheatsheet child). It is the only class either renderer emits that the shipped theme does not define, so the theme is contractually incomplete — a consumer inspecting the DOM finds a hook the default theme silently ignores. Visually benign today because the flex-column parent supplies the spacing.
- Blast radius: src/styles.css:50; src/react/ShortcutCheatsheet.tsx:44; src/vanilla/cheatsheet.ts:51; README.md:241; docs/API.md:384
- Proposed fix: add `.wk-cheatsheet__section { display: block; }` (or a deliberate margin/`break-inside` rule) next to `.wk-cheatsheet__sections`, and include it in the two class tables alongside the B13 additions.
- [x] execute   [ ] skip

### B41. CI job runs an unpinned third-party action while holding CODECOV_TOKEN under a default-scoped GITHUB_TOKEN: build job (.github/workflows/ci.yml:20)
- Category: security
- Impact: 2 (severity 2 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: the workflow declares no `permissions:` block at either level, so `GITHUB_TOKEN` inherits the repository default — read-write `contents` on many repos, letting any step push commits or create releases. In the same job `codecov/codecov-action@v5` is referenced by a mutable major tag rather than a commit SHA and is handed `secrets.CODECOV_TOKEN`; `v5` is a moving pointer the upstream owner can retarget, so a compromised or retagged release executes with the Codecov token in env and the ambient default-scoped `GITHUB_TOKEN` on `push: [main]` runs. Fork `pull_request` runs are already forced read-only by GitHub, so write exposure is limited to same-repo pushes. No hardcoded credentials exist anywhere in the repo — this is the only credential-handling surface.
- Blast radius: .github/workflows/ci.yml:2,7,20,22
- Proposed fix: add a top-level `permissions:\n  contents: read` block after `on:` (no step needs write), and pin the third-party action to a full commit SHA with a trailing version comment: `uses: codecov/codecov-action@<40-char-sha> # v5.x.x`. The first-party `actions/checkout@v4` and `actions/setup-node@v4` may stay on tags.
- [ ] execute   [ ] skip

### B43. Stale .npmignore shadowed by `files`, and the README's API.md link is unreachable from the tarball: `.npmignore` / `files` (.npmignore:1)
- Category: api-surface
- Impact: 1 (severity 1 × blast-radius 1)
- Effort: S
- Risk: low
- Evidence: both `.npmignore` and `package.json` `files` are present; `files` wins, so `.npmignore` is dead config a future maintainer will edit expecting an effect. Verified via `npm pack --dry-run`: the tarball is exactly LICENSE, README.md, package.json and `dist/**` (18 files), so nothing needed is dropped. But README.md:254 links `[docs/API.md](./docs/API.md)` and `docs/` is not in `files`, so the reference the README calls "the full reference" ships as a dangling relative link in the installed package and on npmjs.com.
- Blast radius: .npmignore:1; package.json:27; README.md:254
- Proposed fix: delete `.npmignore` so `files` is the single source of truth, and either add `"docs"` to `files` or change README.md:254 to an absolute GitHub URL so the link resolves from a node_modules copy and from npmjs.com.
- [x] execute   [ ] skip

> **decision-needed (behavioral):** `ShortcutCheatsheet` rebuilds the whole cheatsheet model in the render body on every re-render (src/react/ShortcutCheatsheet.tsx:26) — `getCheatsheetModel()` runs a full registry scan, a bucketing pass and up to 2+G sorts, and the component re-renders on every emit (since B5, emits fire only on real state changes rather than on every keystroke). The vanilla renderer does not have this problem: mount.ts:41 builds the model once at the open transition. Impact 4 (severity 2 × blast-radius 2). The two fixes trade off differently — a `useMemo` keyed on `visible` matches vanilla's semantics but makes the sheet a snapshot of open-time (late registrations won't appear), while a registry `version` counter preserves freshness but adds a member to `ShortcutRegistry`. Pick the semantics before applying.

> **decision-needed (architectural):** `<WhichKeyLayer>` derives its level from React tree depth (`parent.level + 1`, src/react/WhichKeyLayer.tsx:12), so two sibling layers under the same parent both activate the same level. Confirmed at the engine level: with two exclusive layers at level 1, `blockLevel()` is 1 and `isReachable` uses `entry.level >= block`, so the base shortcut is correctly blocked but each exclusive sibling's shortcuts remain fully reachable from the other — two simultaneously-mounted exclusive modals do not isolate from each other. Impact 4 (severity 2 × blast-radius 2). The fix (allocate per layer instance via `engine.pushLayer` and publish `handle.level` through context as state) changes the level a child sees between first render and post-effect render — a real behavioral change. Decide whether sibling isolation is wanted at all.

> **decision-needed (API):** the shipped theme is dark-only with all 15 colours hardcoded and no custom-property hook (src/styles.css). There is no `@media` rule of any kind — no `prefers-color-scheme` (and correspondingly no `prefers-reduced-motion`, which is harmless since the sheet declares zero transitions). Contrast within the popup is fine, so this is not a legibility defect; the cost is that a light-themed app gets a dark slab and a consumer wanting a light variant must out-specify ~15 rules. Impact 3 (severity 1 × blast-radius 3). Hoisting the palette to `--wk-*` custom properties is a theming-API commitment; the zero-cost alternative is simply documenting "the prebuilt stylesheet is a dark theme" in the README Styling section. Decide which.

> **decision-needed (public-API break):** engine internals `Matcher`, `MatcherOptions`, `ShortcutRegistry` and `resolveSort` are part of the published surface (src/engine/index.ts:3-7, re-exported through `which-key/react`). `Matcher`, `MatcherOptions` and `resolveSort` appear nowhere in docs/API.md — undocumented but publicly importable, so any refactor of the matching loop or sort resolver is a breaking change for whoever reached for them. `ShortcutRegistry` is doubly exposed via `engine.registry`, which docs/API.md:144 calls a "Read-only reference" while the class exposes fully mutating `register`/`unregister`/`activateLayer`. `export * from './types'` also publishes the internal `ShortcutEntry`/`GroupEntry` shapes. Impact 2 (severity 1 × blast-radius 2). Removing them requires a `feat!:` bump; the alternative is documenting them under an explicit "Advanced / unstable" heading. Decide before the 1.0 cut.

## Skip (do not re-flag in future runs)
_(none yet)_
