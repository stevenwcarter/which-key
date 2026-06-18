# Keybinding Layers — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorming → spec)
**Branch:** `feat/keybinding-layers`

## Problem

Today which-key has no notion of a "layer" or scope. When a modal opens, there is no
way to say *"suppress all base-page shortcuts while the modal is open, but register a
fresh set of modal-only shortcuts that vanish when it closes."*

The existing primitives only partially overlap:

- **`priority` + per-key stacking** (`registry.ts`): each canonical key maps to a
  priority-sorted bucket; `findActive` returns the highest-priority **enabled** entry.
  A modal can shadow a base key *only by re-registering that exact key* at higher
  priority. A base shortcut the modal does not override (e.g. `g d`) still fires.
- **`enabled` flag**: set at register time only; no post-registration toggle, and no
  grouping.

Neither expresses "block everything beneath me." That is the feature.

## Concept

A **layer** is a push/pop scope for shortcuts whose lifetime is tied to a UI state
(typically a modal being open). The base page is the implicit layer at **level 0**.
Pushing a layer places shortcuts "above" it; popping removes the layer and
auto-unregisters everything bound to it.

Each layer is one of:

- **exclusive** — while active, it blocks all shortcuts in lower layers (the modal case);
- **additive** — it stacks on top; lower-layer shortcuts still fire (an overlay).

A shortcut may set **`global: true`** to pierce exclusive layers (help, command palette,
escape). The engine's built-in `?` help shortcut is registered `global`.

## Resolution algorithm (single source of truth)

The registry owns the set of **active layers**, each `{ id, level, exclusive }`.

- `blockLevel` = the highest `level` among active **exclusive** layers, or `0` if none
  are exclusive.
- An entry is **reachable** iff `entry.level >= blockLevel` **OR** `entry.global`.
- For a given canonical key, the **winner** is the reachable, **enabled** entry with the
  greatest tuple `(level, priority, insertionIndex)` (all higher-wins; `insertionIndex`
  is the entry's position in its priority-sorted bucket, so the most recently registered
  among equal `(level, priority)` wins — preserving today's StrictMode/HMR shadowing).

When no exclusive layer is active, `blockLevel = 0` and every `level >= 0` entry is
reachable → behaviour is identical to today. **This is the back-compat anchor.**

The **same reachability filter** is applied uniformly to:

- `getActive(keys)` — what fires,
- `getActiveCandidates(prefix)` — the which-key popup rows,
- `getAllActive()` — the cheatsheet model,
- `getActiveGroup(prefix)` — group descriptions (groups carry a `level`; reachable iff
  `level >= blockLevel`; no `global` for groups).

Because `matcher.ts` reads matches **only** through `registry.getActive` and
`registry.getActiveCandidates`, centralizing reachability in the registry means **the
matcher needs no changes**.

## Engine API (`controller.ts`, `registry.ts`, `types.ts`)

### Types
- `ShortcutEntry` gains `level: number` and `global: boolean`.
- `GroupEntry` gains `level: number`.
- `ShortcutOptions` gains `global?: boolean` (public) and `level?: number` (advanced —
  used by the layer machinery / React binding; defaults to `0`).

### Registry
- `activateLayer(id: string, level: number, exclusive: boolean): void`
- `deactivateLayer(id: string): void`
- `nextLevel(): number` — `(max active level) + 1` (1 when no layers active).
- `findActive` / candidate / cheatsheet methods apply the reachability filter above.

### Controller (`WhichKeyEngine`)
- `pushLayer(opts?: { exclusive?: boolean; level?: number }): LayerHandle` — the
  documented **imperative engine/vanilla API**. Assigns an id, `level = opts.level ??
  registry.nextLevel()`, calls `activateLayer`, and returns:

  ```ts
  type LayerHandle = {
    readonly level: number;
    register(keys, handler, options?): () => void;     // bound to this layer's level
    registerGroup(prefix, options): () => void;          // bound to this layer's level
    pop(): void;   // unregisters all entries registered via this handle + deactivates the layer
  };
  ```
  `pop()` is idempotent. Push and pop `emit()` a new snapshot (reachability changes can
  alter a visible popup).
- `register` / `registerGroup` honour `options.level` (default `0`) and
  `options.global` so the React binding and `pushLayer` share one code path.
- The built-in `?` help entry is registered with `global: true`.

## React binding (`src/react/`)

New `LayerContext` carries the **current layer level** down the tree (provider seeds
level `0`).

- `<WhichKeyLayer exclusive?={boolean}>children</WhichKeyLayer>`:
  - reads the parent level from `LayerContext`, computes `level = parentLevel + 1`,
  - in an **effect**, calls `engine.activateLayer(id, level, exclusive)` and deactivates
    on cleanup,
  - provides `level` via `LayerContext` to descendants.
- `useShortcut` / `useShortcutGroup` read `level` from `LayerContext` and register with
  that `level`; `useShortcut` gains a `global?` passthrough in its options. **No
  signature change for existing callers.**

### Effect-ordering invariant (subtle — pin with a test)
React runs child effects **before** parent effects on mount. Therefore the layer's
`level` is threaded as a **pure context value computed at render** (`parentLevel + 1`),
*not* derived from registry mutation order. A child `useShortcut` reads its `level` from
context at render and registers it in its own effect; the parent `WhichKeyLayer` updates
the **active-layers set** in its effect. Reachability is only consulted at keypress time,
by which point all effects have settled — so child-before-parent effect ordering is safe.
StrictMode double-mount self-heals because `deactivateLayer`/unregister run on cleanup.

## Vanilla renderer (`src/vanilla/`)

No new component. The engine's `pushLayer` handle **is** the vanilla layer API. The
README documents the modal open/close pattern.

## Documentation & examples (in scope, same branch)

- **README** — new "Layers" section: `pushLayer`/`pop`, `<WhichKeyLayer exclusive>`,
  the `global` flag, exclusive-vs-additive semantics, and a modal example.
- **`examples/react/App.tsx`** — modal demo wrapping its shortcuts in
  `<WhichKeyLayer exclusive>`; opening the modal suppresses page shortcuts while `?`
  still works.
- **`examples/vanilla/index.html`** — `engine.pushLayer({ exclusive: true })` /
  `handle.pop()` around a modal open/close.
- **`CLAUDE.local.md`** — extend the Engine/React architecture bullets to describe layers
  and the resolution rule. Currently 49 lines / ~5 KB; stays well under the 500-line /
  20 KB budget, so no progressive-disclosure split is needed this round.

## Invariants this feature depends on

1. **The matcher reads all matches solely via `registry.getActive` /
   `registry.getActiveCandidates`.** Centralizing reachability in the registry is only
   sufficient *because* of this. → Pin with an integration test: a base `g d` does **not**
   fire while an exclusive layer is active, and fires again after the layer pops.
2. **The popup and cheatsheet must show only reachable shortcuts** (else they advertise
   shortcuts that won't fire). → Integration test: under an exclusive layer the popup
   candidates / cheatsheet exclude suppressed base shortcuts and include layer + global
   ones.
3. **`global` entries pierce exclusivity, and `?` is global.** → Test the `?` help
   toggles the cheatsheet while an exclusive layer is active.
4. **No-layer behaviour is byte-identical to today** (`blockLevel = 0`). → Existing suite
   must stay green unmodified; add a characterization test asserting a level-0 shortcut
   fires with no layers active.

## Testing plan (TDD, co-located in `__tests__/`)

**Registry / resolution unit tests** (`src/engine/__tests__/registry.test.ts`):
- exclusive layer blocks lower-level entries; additive layer leaves them reachable;
- `global` entry reachable through an exclusive layer; a layer can still override a
  global key by registering the same key at higher level;
- `(level, priority, insertionIndex)` tiebreak ordering;
- nested levels (0 < 1 < 2), with exclusive at 1 and additive at 2 → reachable = {1,2}+global;
- `deactivateLayer` re-reveals the layer beneath; `pushLayer().pop()` auto-unregisters
  all the handle's entries and removes the layer.

**Matcher integration** (`src/engine/__tests__/matcher.test.ts` or a new
`layers.test.ts`): base sequence suppressed under exclusive layer; global key still
fires; popup candidates reflect only reachable shortcuts.

**Controller / cheatsheet** (`controller.test.ts`): `getCheatsheetModel` excludes
suppressed entries; `?` global still toggles under an exclusive layer; push/pop emit
snapshots.

**React (jsdom)**: `<WhichKeyLayer>` activates on mount / deactivates on unmount; nested
layers order correctly (parent level < child level); `useShortcut` inside binds to the
layer and is gone after unmount; exclusive `<WhichKeyLayer>` suppresses an outer
shortcut; StrictMode double-mount leaves a single correct active state.

## Out of scope (YAGNI)

- Named activate/deactivate of a layer by string id (push/pop + handle covers it).
- Toggling `enabled` after registration.
- Per-layer custom block-lists / allow-lists (exclusive + additive + global suffices).

## Acceptance criteria

- All four invariants above are covered by passing tests.
- Existing suite passes unmodified; 80% coverage gate holds.
- `lint`, `typecheck`, `test`, `build` all green.
- README, both examples, and `CLAUDE.local.md` updated on this branch.
- A changeset (`minor` — additive public API) is added.
