# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                       # vitest run --coverage (80% gate on lines/statements/functions/branches)
npm run test:watch             # vitest watch
npx vitest run src/engine/__tests__/matcher.test.ts        # single file (no coverage gate)
npx vitest run -t "fires handler for a registered single-key"  # single test by name
npm run typecheck              # tsc --noEmit
npm run lint                   # eslint .
npm run format                 # prettier --write .
npm run format:check           # prettier --check . (what a pre-commit hook failure means)
npm run build                  # tsup: dual ESM+CJS + .d.ts, copies src/styles.css → dist/styles.css
```

Full pre-push suite (what CI runs, on Node 24): `npm run lint && npm run typecheck && npm test && npm run build && npm pack --dry-run`.

Run a subset with plain `npx vitest run`, not `npm test` — coverage is configured with `all: true` over `src/**`, so a partial run trips the 80% thresholds.

## Architecture

Three published entry points, one per directory under `src/`, wired in `package.json` `exports`:

| Export              | Source                 | Role                                                |
| ------------------- | ---------------------- | --------------------------------------------------- |
| `which-key`         | `src/engine/index.ts`  | Framework-free engine                               |
| `which-key/react`   | `src/react/index.ts`   | React binding (re-exports the whole engine surface) |
| `which-key/vanilla` | `src/vanilla/index.ts` | Imperative DOM renderer                             |

`src/react` and `src/vanilla` are two interchangeable _renderers_ over the same engine. Neither owns state; both read `WhichKeySnapshot`/`CheatsheetModel` from the engine. Per CONTRIBUTING, keep `src/engine/` free of framework dependencies (its only DOM touchpoints are the default `target = document` and the `navigator.platform` check that resolves `Mod`).

### Runtime flow

`keydown` → `Matcher.handleKeyDown` → callbacks (`onFire` / `onShowPopup` / `onHidePopup`) → `createWhichKey` recomputes `snapshot` and `emit()`s to subscribers → React (`useSyncExternalStore`) or vanilla (`engine.subscribe(render)`) repaints.

`Matcher` (`src/engine/matcher.ts`) owns the pending-sequence buffer and all timers. Three cases after canonicalizing a key onto the buffer:

- **pure leaf** (match, no continuations) → fire immediately
- **leaf AND prefix** → commit buffer, wait `timeoutMs`, then fire the leaf with a _synthetic_ `KeyboardEvent`
- **prefix only** → commit buffer, wait `timeoutMs`, then show the popup (refresh immediately if already visible)

`Escape` cancels a partial sequence unless an explicit `Escape` leaf exists for the prospective sequence.

### Snapshot invariants (breaking these causes React loops / stale UI)

`getSnapshot()` must return the cached `snapshot` object — never freshly constructed per call, or `useSyncExternalStore` re-renders forever. Snapshots must also be deeply immutable: `onShowPopup` copies the Matcher's live `currentSequence` array rather than aliasing it (see the comment in `controller.ts`). Both React components supply a `getServerSnapshot` that renders nothing, which is what makes the popup and cheatsheet SSR-safe.

### Canonical key strings are the join key

`parseKey`/`parseSequence` (registration time) and `eventToCanonical` (runtime) both funnel through `buildCanonical` in `src/engine/keys.ts` and **must produce byte-identical strings** — registry lookups are plain `Map` gets on `"Ctrl+Shift+P"`-style strings, joined by spaces for sequences. The subtle rules encoded there:

- letters uppercase under any modifier; `Shift+` is emitted only alongside another modifier
- specials (`Tab`, arrows, `Space`, `F1`–`F12`) keep `Shift+` verbatim
- everything else drops `Shift+` (the shifted glyph is already the base char: `Shift+/` → `?`)
- a bare uppercase letter at registration implies Shift, so `parseKey('N')` matches a real Shift+n press
- `Mod` resolves to `Cmd` on Mac, `Ctrl` elsewhere

Any change to one direction must be mirrored in the other, with tests in `src/engine/__tests__/keys.test.ts`.

### Registry resolution: stacking, layers, global

`ShortcutRegistry` keeps a priority-sorted bucket per canonical key (and per group prefix), so multiple components may bind the same key simultaneously. `findActive` picks the winner by **level → priority → latest registration**. Layers add a floor: the highest active `exclusive` layer sets `blockLevel()`, and entries below it are unreachable unless `global: true`. `pushLayer()` returns a `LayerHandle` that tracks everything registered through it and unregisters it all on `pop()`; the React `<WhichKeyLayer>` does the same via `LayerContext`, which `useShortcut`/`useShortcutGroup` read to stamp a `level` on each registration.

Design rationale for layers lives in `docs/superpowers/specs/2026-06-17-keybinding-layers-design.md`.

### Styling contract

Both renderers emit the same `wk-*` class names consumed by `src/styles.css` (documented in README). React hardcodes the `wk-` prefix; only `mountWhichKey` accepts `classPrefix`. Changing a class name means touching the React components, the vanilla renderers, `src/styles.css`, and the README table together.

## Conventions

- **TDD.** Write the failing test first, in the `__tests__/` directory beside the source. `src/engine/__tests__/` uses plain unit tests; `src/react/__tests__/` uses Testing Library with `act()` around dispatched `keydown` events and `vi.useFakeTimers()` for the sequence timeout.
- **Named exports only** (examples excepted). Anything public must be added to the relevant `index.ts` _and_ to `docs/API.md`, which is the maintained full reference.
- Strict TS with `noUnusedLocals`/`noUnusedParameters`; no `any` without justification.
- **Formatting is enforced at commit time.** A husky `pre-commit` hook runs `lint-staged`, which `prettier --write`s the staged files and re-stages them — so a drifted commit is corrected rather than rejected. `npm run format:check` verifies the whole tree. Note CI does _not_ yet run this check.
- **Conventional Commits** are enforced by the husky `commit-msg` hook. Releases are derived from them via `npm run release` (`commit-and-tag-version`); while pre-1.0, `feat:` bumps a patch and `feat!:`/`BREAKING CHANGE:` bumps a minor. `npm run release` neither pushes nor publishes.
