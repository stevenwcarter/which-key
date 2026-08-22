# tidy batch 1 — style & structure cleanup (design)

Date: 2026-08-22
Branch: `tidy/2026-08-22`
Base: `34dd498` (`docs: apply doc-comment updates`), itself on `e3f3360` (`chore(release): 0.2.1`)
Findings source: `TIDY.md` (35 findings from the 2026-08-22 tidy triage)

## Scope

Execute **33 of 35** findings. Full text for every T-ID lives in `TIDY.md` at the repo
root — this spec records scope, ordering, decisions, and invariants; it does not restate
each proposed fix. Executing agents read the finding text from `TIDY.md`.

**Deliberately excluded, and staying in `TIDY.md` for a later pass:**

- **T13** — `Matcher.handleKeyDown` split (127 lines, four terminal branches). Not selected.
- **T30** — `getActiveGroup` has no `global` escape hatch from an exclusive layer. Not
  selected; remains a decision-needed marker. **T15 must preserve this asymmetry** —
  see Invariants below.

## Decisions taken before execution

Both were `decision-needed` markers that the skill never auto-applies. The user chose:

### D1 — T12: the `+` key becomes bindable via a `'Plus'` alias

`eventToCanonical` can emit `'+'` for a real keypress, but `parseKey` splits on `'+'`, so
no registration string could ever produce it — the two directions disagreed and any `+`
binding silently never matched.

**Chosen:** add `['plus', '+']` to `SPECIAL_KEY_ALIASES`.

- `register('Plus')` → canonical `'+'`; `register('Ctrl+Plus')` → canonical `'Ctrl++'`.
- **`parseKey`'s splitting logic is NOT changed.** No existing canonical string moves.
- Rejected alternative: a trailing-`+` special case in the split loop. It touches the
  join-key invariant directly and adds an edge case that both canonicalization directions
  would have to mirror.

### D2 — T4: apply `readonly` to the published snapshot types

`CLAUDE.md` requires snapshots to be "deeply immutable" but no published type carried
`readonly`, so the invariant lived only in comments and one defensive array copy.

**Chosen:** add `readonly` to `WhichKeySnapshot`, `WhichKeyCandidate`, and the cheatsheet
shapes, including `readonly string[]` / `readonly WhichKeyCandidate[]` on the arrays.

- This is a public-API signature change, accepted deliberately: it breaks only consumers
  who _write into_ a snapshot, which the docs already forbid, and the package is pre-1.0.
- Per `CLAUDE.md`, `docs/API.md` must be updated in the same commit.

## Invariants this work depends on

Recorded explicitly so that a later change touching one of these funnels can grep for who
relies on it. Several tasks below are refactors _across_ these seams, so each gets a
pinning test rather than a prose assurance.

1. **Canonical-key parity.** `parseKey`/`parseSequence` (registration) and
   `eventToCanonical` (runtime) both funnel through `buildCanonical` and must produce
   byte-identical strings; registry lookups are plain `Map` gets. **T9, T10, T11, T12, T27,
   T28 all edit this funnel.** T9 changes `buildCanonical`'s signature from four positional
   booleans to a `Modifiers` object — both call sites must be updated together, and a
   round-trip test (`parseKey(spec)` === `eventToCanonical(matching event)`) must pin the
   pairing rather than relying on each direction's own unit tests staying consistent.
2. **Snapshot identity.** `getSnapshot()` must return the cached object, never a fresh
   construction, or `useSyncExternalStore` re-renders forever. **T19 consolidates two
   store-subscription fallbacks** — the shared `EMPTY` sentinel must stay a single hoisted
   object. Pin with an identity assertion (`getSnapshot() === getSnapshot()`), and keep the
   SSR tests green.
3. **Registry resolution order.** level → priority → latest-registration. **T14 and T15
   extract this logic into shared helpers.** The `findIndex(e => e.priority > entry.priority)`
   insertion point is what makes "latest wins at equal priority" true, and both `findActive`
   and `getActiveGroup` tiebreak on bucket index.
4. **Shortcut vs. group reachability asymmetry.** A shortcut may escape an exclusive layer
   via `global: true`; a group label may not, because `GroupEntry` has no `global` field.
   **T15 unifies the winner cascade across both and must keep the two eligibility
   predicates distinct.** This asymmetry is T30, which is intentionally NOT being fixed in
   this batch — T15 must not silently "fix" or erase it.
5. **The `wk-*` class contract.** Both renderers emit the same class names, pinned by
   `src/__tests__/class-contract.test.tsx` and `styles-contract.test.ts`. **T16, T20, T23,
   T32, T33, T34 all move class-name-emitting code.** The contract tests must stay green
   untouched — they are the guard, so do not edit them.
6. **Cross-renderer copy parity.** `'(no description)'`, `'Keyboard shortcuts'`, and
   `'Press Escape to close.'` must read identically from both renderers. Unlike the class
   contract, this has **no parity test today** — T33 centralizes the strings, and should
   add one so the two renderers cannot drift again.
7. **Console-warning text.** 16 diagnostic sites are enumerated in `docs/API.md`'s Console
   warnings table and asserted in the engine tests. **T6 collapses the three-times-repeated
   canonicalize-or-warn preamble** and must keep every emitted string byte-identical.

## Out of scope (do not let these creep in)

- The five open `decision-needed` markers in `bughunt.md` (cheatsheet modality / Escape
  double-handling, unsilenceable `console.warn` diagnostics, React portalling, `SPECIAL_KEYS`
  double duty / B48, B41, B49). Several findings touch adjacent code and say so; none may
  be extended into those decisions.
- Specifically: **T6 must not** become a global `warn()` funnel taking an `onWarn` sink —
  that is bughunt's open public-API marker. **T16 must not** touch either renderer's
  Escape-listener behavior — that is bughunt's open modality marker; T16 is scoped to Tab
  handling only.
- Refactoring existing tests. New characterization tests are welcome; edits to existing
  test files are not (skill one-way rule).

## Execution order

Six milestones. Ordering is derived from the cross-references the merge pass recorded.
Run the full suite at each milestone boundary.

### Milestone A — toolchain & lint config (4)

Deliberately first: the stronger lint then guards the 29 refactors that follow.

`T25` → `T2` → `T3` → `T24`

- **T25** — _add_ the undeclared `@types/node` devDependency (an addition, not a deletion,
  despite coming from the dead-code lens).
- **T2** — add `js.configs.recommended`; must land **before T3**.
- **T3** — type-aware linting; **its own commit**. Expect a first run to surface new
  findings. If the fallout is more than a handful of mechanical fixes, **stop and report**
  rather than silently expanding this batch's scope.
- **T24** — jsx-a11y preset spread ordering.

### Milestone B — `src/engine/keys.ts` (7)

All six of these edit the canonical-key funnel; see Invariant 1. Order within the file
matters because T10, T11, T12 sit within ~6 lines of each other.

`T27` → `T8` → `T28` → `T9` → `T10` → `T11` → `T12`

- **T12** is `risk: high` → characterization tests first (D1 is the chosen convention).

### Milestone C — `src/engine/controller.ts` + `registry.ts` (10)

`T1` → `T6` → `T18` → `T26` → `T5` → `T7` → `T14` → `T15` → `T29` → `T4`

- **T1 first**: `resolveTimeoutMs` should own the `DEFAULT_TIMEOUT_MS` constant that T18
  wants, and the helpKey try/catch it extracts is one of the three sites T6 rewrites.
- **T15** is `risk: high` → characterization tests first; must preserve Invariant 4.
- **T4** last in this milestone (D2; public-API change; update `docs/API.md` in the same
  commit).

### Milestone D — shared extractions across renderers (5)

`T16` → `T19` → `T33` → `T23` → `T32`

- **T16 first** — T17 and T20 both consume the shared `trapTab` it creates.
- **T33** should add the missing cross-renderer copy parity test (Invariant 6).

### Milestone E — renderer cleanups (6)

`T17` → `T20` → `T21` → `T34` → `T22` → `T31`

- **T17** requires T16 and T19 landed.
- **T20** requires T16 landed; must not run concurrently with T33.
- **T34** should be written against T23's `el()` helper.

### Milestone F — docs (1)

`T35` — correct `CLAUDE.md:42`, which says the deferred leaf fires with a _synthetic_
`KeyboardEvent`. The code deliberately reuses the original (`src/engine/matcher.ts:149`,
`const fireEvent = event;`) precisely because a never-dispatched synthetic event would have
`target === null`, would not be cancelable, and would report all modifier flags false.

## Per-task contract

Enforced by `superpowers:subagent-driven-development`:

1. Read the finding from `TIDY.md` (file:line, proposed fix, risk).
2. If `risk: high — needs characterization tests first` (**T12, T15, T25**): write
   characterization tests for the affected unit, confirm they pass **on unchanged code**,
   commit as `test: characterize <unit> before tidy [T<n>]`.
3. Apply the change.
4. Run `npm run lint`, `npm run typecheck`, `npm run format`. Fix new warnings the change
   introduced; leave preexisting unrelated ones alone.
5. At each milestone boundary: `npm test` (full suite, 381 tests). On red: bisect within
   the milestone, revert the offender, surface the diagnosis.
6. Commit as `tidy(<lens>): <summary> [T<n>]`.
7. **Strip the finding from `TIDY.md` in the same commit.** Non-negotiable.

Never `--no-verify`. The husky `pre-commit` hook runs `lint-staged` (prettier, re-stages)
and `commit-msg` enforces Conventional Commits with a 100-char body line limit.

## Verification

- Per-task: lint + typecheck clean.
- Per-milestone: full `npm test` green.
- Final: `npm run lint && npm run typecheck && npm test && npm run build && npm pack --dry-run`
  — the full CI suite — plus `npm run format:check`.
- `TIDY.md` should contain exactly **T13 and T30** when the batch completes.
