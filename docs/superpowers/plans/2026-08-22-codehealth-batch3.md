# code-health batch 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five code-health findings (B15, B44, B45, B46, B47) and implement two decision-needed markers the maintainer has given explicit direction on (D1: a registry `version` counter; D2: `prefers-color-scheme` theming with an author override).

**Architecture:** `which-key` is a framework-free keyboard-shortcut engine (`src/engine/`) with two interchangeable renderers over it — React (`src/react/`) and imperative DOM (`src/vanilla/`). Tasks run engine-first (controller validation → matcher → canonicalization), then the React perf fix, then docs, then the theming change last because it is the only one that touches CSS, both renderers, and existing test assertions together.

**Tech Stack:** TypeScript 5.7 strict, React 19, Vitest 2 + jsdom + Testing Library, ESLint 9 flat config, Prettier (enforced by a husky `pre-commit` → `lint-staged` hook), tsup.

**Spec:** `docs/superpowers/specs/2026-08-22-codehealth-batch3-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Branch:** `codehealth/2026-08-22-batch3`, stacked on `codehealth/2026-08-21-batch2` (PR #2, open).
- **Baseline at eb6a9e9:** lint 0/0, typecheck clean, **313 tests in 20 files**, coverage 99.65% statements / 96.79% branches, build green, `npm pack --dry-run` 18 files.
- **Verification, run before every commit:** `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`. All five green. No `--no-verify`, no `--allow-dirty`.
- **Run a single test file** with `npx vitest run <path>`, never `npm test` — coverage is `all: true` over `src/**`, so a partial run trips the 80% gate.
- **A husky `pre-commit` hook** runs `lint-staged` → `prettier --write` on staged files and re-stages them. Formatting self-corrects; do not fight it and never bypass it.
- **Out of scope, must remain untouched in `bughunt.md`:** finding **B41**, and the **five** decision-needed markers with no `User Note` (cheatsheet-not-modal, unsilenceable warnings, no React portal, sibling-layer isolation, engine-internals public-API break).
- **Each commit strips its own item's block from `bughunt.md`** — heading, bullets, checkbox line; and for D1/D2 the `> **decision-needed …**` blockquote _plus_ its `User Note` line.
- **Soft-failure convention** (established across batch 2, extended here by B15/B45/B47): every message starts with the literal `[whichkey] ` prefix; warn, never throw; never change a public return type; allocate ids only after validation. When composing another module's `Error` message, route it through the existing `stripWhichkeyPrefix` helper in `src/engine/controller.ts`.
- **Every new `console.warn` must be added to `docs/API.md`'s "Console warnings" table**, verbatim. That table is the published register.
- **Test files are never a fix target** — add NEW tests, do not refactor existing ones. **One sanctioned exception, Task 7 only** (seven `style.backgroundColor` assertions D2 deliberately invalidates; listed there).
- **Named exports only.** Anything public goes in the relevant `index.ts` _and_ `docs/API.md`.
- Strict TS, `noUnusedLocals`/`noUnusedParameters`, **no `any` without justification**. Conventional Commits (husky `commit-msg` hook).
- **Milestone full-suite runs** after Tasks 3, 5 and 7.

## Invariants this work depends on

- **Canonical key strings are the join key.** `parseKey`/`parseSequence` (registration) and `eventToCanonical` (runtime) must produce byte-identical strings. **Task 4 (B15) changes what `parseKey` produces**, so every alias must round-trip against a real event or the fix creates the dead binding it removes.
- **`getSnapshot()` returns the cached object; snapshots are deeply immutable.** Task 5 (D1) must not put the cheatsheet model in the snapshot.
- **The input-echo latch (`bufferTouchedInput`) is load-bearing.** Task 3 (B44) changes behaviour _inside_ its guard and must strengthen it, never weaken it.
- **Both renderers emit the same `wk-*` class contract**, guarded mechanically by `src/__tests__/class-contract.test.tsx`. Task 7 must keep that guard green and register any new class in the `CONTRACT` array and both doc tables.

## File Structure

**Modified:**

| File                                                  | Tasks         | Responsibility after this batch                                                                          |
| ----------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `src/engine/controller.ts`                            | 1, 2          | Adds `helpKey: ''` and `level` validation to the existing soft-failure family.                           |
| `src/engine/matcher.ts`                               | 3             | Leaf-AND-prefix branch hides a stale popup on taint, matching prefix-only.                               |
| `src/engine/keys.ts`                                  | 4             | Case-insensitive alias table normalising special-key bases before `buildCanonical`.                      |
| `src/engine/registry.ts`                              | 5             | Monotonic `version`, bumped by every mutator, exposed read-only.                                         |
| `src/react/ShortcutCheatsheet.tsx`                    | 5             | Memoises the cheatsheet model on `registry.version`.                                                     |
| `src/styles.css`                                      | 7             | 15 colours hoisted to `--wk-*`; dark default, `prefers-color-scheme: light`, `[data-wk-theme]` override. |
| `src/react/WhichKeyPopup.tsx`, `src/vanilla/popup.ts` | 7             | Emit opacity as a custom property instead of a composed `backgroundColor`.                               |
| `docs/API.md`                                         | 1, 2, 5, 6, 7 | Console-warnings table rows; `version`; the eight undocumented exports; the theming contract.            |
| `README.md`                                           | 7             | Styling section documents theming + the override attribute.                                              |
| `src/__tests__/class-contract.test.tsx`               | 7             | Only if Task 7 adds a class (sanctioned by the contract file's own rule).                                |
| `bughunt.md`                                          | every task    | Shrinks by one item per commit.                                                                          |

---

## Task 1: B47 — warn on `helpKey: ''`

**Files:**

- Modify: `src/engine/controller.ts` (the `if (helpKey)` guard)
- Modify: `docs/API.md` (Console warnings table; the `helpKey` row)
- Test: `src/engine/__tests__/controller.test.ts`
- Modify: `bughunt.md` (strip B47)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: a new warning string `[whichkey] invalid helpKey ""; help shortcut disabled.` that Task 6 will see when sweeping docs.

**The bug:** `createWhichKey` guards help registration with `if (helpKey)`. `''` is falsy, so an empty string skips registration entirely and never reaches `parseKey` — no `?` binding, no diagnostic, indistinguishable from the documented `helpKey: null`. Batch 2 made "warn, never silently no-op" the house rule across seven other paths; this is the only one left that fails silently.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/controller.test.ts`:

```ts
describe('createWhichKey — empty-string helpKey [B47]', () => {
  it('warns that an empty helpKey disabled the help shortcut', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ helpKey: '' });
    expect(warn).toHaveBeenCalledWith('[whichkey] invalid helpKey ""; help shortcut disabled.');
    expect(wk.registry.getAllActive()).toHaveLength(0);
    warn.mockRestore();
  });

  it('stays silent for the documented helpKey: null', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createWhichKey({ helpKey: null });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('still binds a valid helpKey', () => {
    const wk = createWhichKey({ helpKey: 'F1' });
    expect(wk.registry.getActive('F1')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/controller.test.ts -t "B47"`
Expected: the first test FAILS — no warning is emitted at all (`Number of calls: 0`). The second and third should already pass; they pin behaviour the fix must not change.

- [ ] **Step 3: Apply the fix**

In `src/engine/controller.ts`, replace `if (helpKey) {` with a branch that distinguishes the two falsy cases:

```ts
  // `null` is the documented way to disable help deliberately and stays
  // silent. `''` is almost certainly a mistake — it is falsy, so it skipped
  // registration without ever reaching parseKey, making it the one
  // invalid-input path in the library that failed with no diagnostic.
  if (helpKey === '') {
    console.warn('[whichkey] invalid helpKey ""; help shortcut disabled.');
  } else if (helpKey) {
```

...leaving the existing `try { registry.register({...}) } catch { ... }` body unchanged inside the `else if`.

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts`
Expected: PASS, including the pre-existing `helpKey` tests from B23.

- [ ] **Step 5: Document the warning**

In `docs/API.md`, add a row to the **Console warnings** table:

```
| `invalid helpKey ""; help shortcut disabled` | `helpKey` was an empty string. | Pass `helpKey: null` to disable help deliberately, or a valid key string. |
```

Also extend the `helpKey` row in the `createWhichKey` options table to note that `''` warns while `null` is silent.

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`

- [ ] **Step 7: Strip B47 from `bughunt.md` and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts docs/API.md bughunt.md
git commit -m "fix(api-surface): warn when helpKey is an empty string [B47]"
```

---

## Task 2: B45 — validate `level` on `register` and `registerGroup`

**Files:**

- Modify: `src/engine/controller.ts` (`register`, `registerGroup`)
- Modify: `docs/API.md` (Console warnings table; `ShortcutOptions` `level` row; `registerGroup` `level` row)
- Test: `src/engine/__tests__/controller.test.ts`
- Modify: `bughunt.md` (strip B45)

**Interfaces:**

- Consumes: the soft-failure convention; the `pushLayer` validation shape from batch 2's B34.
- Produces: warning `[whichkey] invalid level <value> for "<keys>"; expected a non-negative integer. Falling back to 0.`

**The bug (verified against the built bundle):** `level` is public on `ShortcutOptions` and on `registerGroup`'s options, and is unvalidated. `register('z', fn, { level: -1 })` returns a live unregister function, the entry lands in the registry, and `registry.getActive('z')` is `undefined` with **no warning** — `blockLevel()` floors at 0 and `isReachable` requires `entry.global || entry.level >= block`. B34 closed this for `pushLayer`; this is the same silent-dead-shortcut failure at a different public entry point.

**Fall back to `0`, not `nextLevel()`** — unlike `pushLayer`, a bare registration has no layer of its own, and 0 is the documented default for `ShortcutOptions.level`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('register/registerGroup — level validation [B45]', () => {
  it.each([-1, 1.5, NaN, Infinity])('warns and falls back to 0 for level %p', (bad) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ helpKey: null });
    wk.register('z', vi.fn(), { level: bad, description: 'Zed' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid level'));
    expect(wk.registry.getActive('z')).toBeDefined();
    warn.mockRestore();
  });

  it('warns and falls back to 0 for an invalid registerGroup level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ helpKey: null });
    wk.registerGroup('g', { description: 'Go', level: -1 });
    wk.register('g a', vi.fn(), { description: 'Alpha' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid level'));
    expect(wk.registry.getActiveGroup('g')?.description).toBe('Go');
    warn.mockRestore();
  });

  it('honours a valid explicit level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ helpKey: null });
    wk.register('z', vi.fn(), { level: 2 });
    expect(warn).not.toHaveBeenCalled();
    expect(wk.registry.getActive('z')?.level).toBe(2);
    warn.mockRestore();
  });

  it('does not warn when level is omitted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ helpKey: null });
    wk.register('z', vi.fn());
    expect(warn).not.toHaveBeenCalled();
    expect(wk.registry.getActive('z')?.level).toBe(0);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/controller.test.ts -t "B45"`
Expected: the `it.each` cases FAIL (no warning; and for `-1`, `getActive('z')` is `undefined`), and the `registerGroup` case FAILS. The last two should already pass.

- [ ] **Step 3: Add a shared validator**

At module scope in `src/engine/controller.ts`, beside `stripWhichkeyPrefix`:

```ts
// `level` is public on ShortcutOptions and on registerGroup's options. A
// negative or non-integer value is silently fatal: blockLevel() floors at 0
// and isReachable requires entry.level >= block, so the entry registers, the
// unregister function looks healthy, and the key simply never fires. B34
// closed the same hole for pushLayer; this is the registration-side twin.
// Falls back to 0 rather than nextLevel() — a bare registration has no layer
// of its own, and 0 is the documented default.
const resolveLevel = (requested: number | undefined, what: string): number => {
  if (requested === undefined) return 0;
  if (Number.isInteger(requested) && requested >= 0) return requested;
  console.warn(
    `[whichkey] invalid level ${String(requested)} for "${what}"; ` +
      'expected a non-negative integer. Falling back to 0.',
  );
  return 0;
};
```

- [ ] **Step 4: Use it at both call sites**

In `register`, replace `level: opts?.level ?? 0,` in the `entry` literal with:

```ts
        level: resolveLevel(opts?.level, keys),
```

In `registerGroup`, replace `level: opts.level ?? 0,` with:

```ts
        level: resolveLevel(opts.level, prefix),
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/engine/__tests__/layers.test.ts`
Expected: PASS. The layers suite must be unaffected — `pushLayer` stamps an already-validated level onto its tracked registrations, so `resolveLevel` sees a valid value and stays silent.

- [ ] **Step 6: Document**

Add to the **Console warnings** table in `docs/API.md`:

```
| `invalid level <n> for "<keys>"; expected a non-negative integer` | `level` on `register`/`registerGroup` was negative, fractional, `NaN` or `Infinity`. | Omit `level` and let `pushLayer` / `<WhichKeyLayer>` stamp it, or pass a non-negative integer. |
```

Extend the `level` row in the `ShortcutOptions` table and the `registerGroup` options table to state the constraint and the fallback.

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`

- [ ] **Step 8: Strip B45 from `bughunt.md` and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts docs/API.md bughunt.md
git commit -m "fix(api-surface): validate an explicit level on register and registerGroup [B45]"
```

---

## Task 3: B44 — hide a stale popup when a leaf-AND-prefix keystroke taints the buffer

**Files:**

- Modify: `src/engine/matcher.ts` (the `if (leaf && hasCandidates)` branch)
- Test: `src/engine/__tests__/matcher.test.ts`
- Modify: `bughunt.md` (strip B44)

**Interfaces:**

- Consumes: `MatcherOptions.onHidePopup()`, and the private `popupVisible` / `bufferTouchedInput` fields.
- Produces: no signature change.

**The bug:** batch 2's B21 added `if (this.popupVisible && !this.bufferTouchedInput) onShowPopup(...)` to the leaf-AND-prefix branch. The latch correctly suppresses painting newly-tainted characters, but unlike the prefix-only branch it never calls `onHidePopup` — so a popup showing untainted content stays on screen, stale, after a tainted keystroke. No disclosure (the stale content was already visible and the latch still blocks the new characters), but the window is bounded only incidentally, by chain depth × `timeoutMs`.

**The repro must have no bare `g` leaf.** `g` alone must be prefix-only, because it is the prefix-only branch's timer that sets `popupVisible`. An earlier version of this finding got that wrong; `bughunt.md` is corrected.

- [ ] **Step 1: Write the failing test**

```ts
describe('Matcher — tainted leaf-AND-prefix hides a stale popup [B44]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides an already-visible popup when the buffer becomes tainted', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const onHidePopup = vi.fn<HideFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup, onHidePopup }, 50);
    // No bare 'g' leaf: 'g' must be prefix-only so its timer sets popupVisible.
    registry.register(entry({ id: 'gh', keys: 'g h', enableOnInputs: true }));
    registry.register(entry({ id: 'ghx', keys: 'g h x', enableOnInputs: true }));

    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(50);
    expect(onShowPopup).toHaveBeenLastCalledWith({ currentSequence: ['g'] });
    onShowPopup.mockClear();
    onHidePopup.mockClear();

    // 'h' typed into a text field echoes a character and taints the buffer.
    const input = document.createElement('input');
    matcher.handleKeyDown(ev({ key: 'h' }, input));

    expect(onShowPopup).not.toHaveBeenCalled();
    expect(onHidePopup).toHaveBeenCalled();
  });

  it('does not hide when the buffer is untainted', () => {
    const onHidePopup = vi.fn<HideFn>();
    const { registry, matcher } = buildMatcher({ onHidePopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h' }));
    registry.register(entry({ id: 'ghx', keys: 'g h x' }));

    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(50);
    onHidePopup.mockClear();

    matcher.handleKeyDown(ev({ key: 'h' }));
    expect(onHidePopup).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts -t "B44"`
Expected: the first test FAILS on `expect(onHidePopup).toHaveBeenCalled()` — the branch currently skips the refresh but never hides. The second should already pass.

- [ ] **Step 3: Apply the fix**

In `src/engine/matcher.ts`, in the `if (leaf && hasCandidates)` branch, replace the refresh guard:

```ts
if (this.popupVisible && !this.bufferTouchedInput) {
  this.options.onShowPopup({ currentSequence: [...this.buffer] });
}
```

with one that also hides on taint, mirroring the prefix-only branch:

```ts
if (this.popupVisible) {
  if (this.bufferTouchedInput) {
    // Mirror the prefix-only branch: a tainted buffer must not merely
    // stop refreshing, it must clear what is already on screen. Skipping
    // the refresh alone left untainted content displayed until some
    // later terminal outcome reached resetBuffer — a window bounded
    // only by chain depth x timeoutMs, not by design.
    this.popupVisible = false;
    this.options.onHidePopup();
  } else {
    this.options.onShowPopup({ currentSequence: [...this.buffer] });
  }
}
```

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts`
Expected: PASS, including batch 2's B21 tests — the untainted refresh path is unchanged.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`

- [ ] **Step 6: Strip B44 from `bughunt.md` and commit**

```bash
git add src/engine/matcher.ts src/engine/__tests__/matcher.test.ts bughunt.md
git commit -m "fix(correctness): hide a stale popup when a leaf-and-prefix keystroke taints the buffer [B44]"
```

> ### 🚩 Milestone after Task 3
>
> Run `npm test`. Expected green. On red: bisect within Tasks 1–3, revert the offender, surface the diagnosis before continuing.

---

## Task 4: B15 — case-insensitive alias table for special-key bases

**Files:**

- Modify: `src/engine/keys.ts` (`SPECIAL_KEYS` area and `parseKey`)
- Modify: `docs/API.md` (Console warnings table; the Key-string syntax section)
- Test: `src/engine/__tests__/keys.test.ts`
- Modify: `bughunt.md` (strip B15)

**Interfaces:**

- Consumes: `buildCanonical(base, ctrl, alt, shift, meta)` and `eventToCanonical(event)`, both already in `keys.ts`.
- Produces: `parseKey` now normalises aliased bases. Warning: `[whichkey] key string "<input>": "<base>" is not a key name any browser reports; this binding will never match.`

**The bug (empirically confirmed):** `parseKey` passes any multi-character base through verbatim, so `register('escape')`, `'tab'`, `'enter'`, `'space'`, `'up'`, `'esc'`, `'backspace'`, `'f1'` all succeed and produce canonical strings no `KeyboardEvent` can ever produce. Firing every corresponding real key gave `{"escape":0,"tab":0,"enter":0,"space":0,"up":0,"ArrowUp":1,"Escape":1,"esc":0,"f1":0,"F1":1}` — only exactly-cased names fire. Because `parseKey` throws on an unknown _modifier_, a consumer reasonably assumes bad key strings are validated.

**The correctness bar — this is what the task is really about.** For every alias, `parseKey(alias)` must equal `eventToCanonical(<the real event for that key>)`. Testing the mapping alone would let a plausible-but-wrong alias through and recreate the dead binding. Test the round trip.

**Do not throw for an unrecognised multi-character base.** Exotic `event.key` values (`'MediaPlayPause'`, `'BrowserBack'`, IME keys) must stay bindable, so an unknown base warns and passes through.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/keys.test.ts`:

```ts
describe('parseKey — special-key aliases [B15]', () => {
  // The bar is a ROUND TRIP: what parseKey produces for the alias must equal
  // what eventToCanonical produces for the real key press.
  const cases: Array<[string, KeyboardEventInit]> = [
    ['escape', { key: 'Escape' }],
    ['esc', { key: 'Escape' }],
    ['ESC', { key: 'Escape' }],
    ['tab', { key: 'Tab' }],
    ['enter', { key: 'Enter' }],
    ['backspace', { key: 'Backspace' }],
    ['space', { key: ' ' }],
    ['up', { key: 'ArrowUp' }],
    ['down', { key: 'ArrowDown' }],
    ['left', { key: 'ArrowLeft' }],
    ['right', { key: 'ArrowRight' }],
    ['home', { key: 'Home' }],
    ['end', { key: 'End' }],
    ['pgup', { key: 'PageUp' }],
    ['pagedown', { key: 'PageDown' }],
    ['f1', { key: 'F1' }],
    ['F12', { key: 'F12' }],
  ];

  it.each(cases)('parseKey(%p) round-trips against the real event', (alias, init) => {
    expect(parseKey(alias)).toBe(eventToCanonical(new KeyboardEvent('keydown', init)));
  });

  it('applies aliases under modifiers too', () => {
    expect(parseKey('ctrl+esc')).toBe(
      eventToCanonical(new KeyboardEvent('keydown', { key: 'Escape', ctrlKey: true })),
    );
  });

  it('warns for a multi-character base no browser reports, without throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => parseKey('Blorp')).not.toThrow();
    expect(parseKey('Blorp')).toBe('Blorp');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('will never match'));
    warn.mockRestore();
  });

  it('leaves an exotic but real event.key bindable and silent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseKey('MediaPlayPause')).toBe(
      eventToCanonical(new KeyboardEvent('keydown', { key: 'MediaPlayPause' })),
    );
    warn.mockRestore();
  });

  it('does not warn or alter single-character bases', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseKey('a')).toBe('a');
    expect(parseKey('/')).toBe('/');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

Note the last two: `'MediaPlayPause'` is a real `event.key`, so it must round-trip _and_ not warn if you choose to recognise the pattern — if your implementation warns for it, say so and justify it rather than silently loosening the assertion.

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/keys.test.ts -t "B15"`
Expected: most `it.each` cases FAIL — `parseKey('escape')` returns `'escape'` while `eventToCanonical` returns `'Escape'`. The warn case FAILS (no warning). The single-character case should already pass.

- [ ] **Step 3: Add the alias table**

In `src/engine/keys.ts`, after the `SPECIAL_KEYS` set:

```ts
// Consumers reasonably assume a key string is validated, because parseKey
// throws on an unknown MODIFIER. It did not validate the base, so
// register('escape') produced a canonical string no KeyboardEvent can ever
// emit — a silently dead binding. Map the common spellings onto the exact
// `event.key` values the runtime reports.
const SPECIAL_KEY_ALIASES = new Map<string, string>([
  ...[...SPECIAL_KEYS].map((k) => [k.toLowerCase(), k] as const),
  ['esc', 'Escape'],
  ['space', 'Space'],
  ['spacebar', 'Space'],
  ['up', 'ArrowUp'],
  ['down', 'ArrowDown'],
  ['left', 'ArrowLeft'],
  ['right', 'ArrowRight'],
  ['pgup', 'PageUp'],
  ['pgdn', 'PageDown'],
  ['pagedn', 'PageDown'],
]);

/** `f1`-`f12` in any casing -> `F1`-`F12`. */
const FUNCTION_KEY_RE = /^f([1-9]|1[0-2])$/i;

const normalizeBase = (base: string, input: string): string => {
  if (base.length <= 1) return base;
  const alias = SPECIAL_KEY_ALIASES.get(base.toLowerCase());
  if (alias !== undefined) return alias;
  if (FUNCTION_KEY_RE.test(base)) return base.toUpperCase();
  if (SPECIAL_KEYS.has(base)) return base;
  // Not a name we recognise. Do NOT throw — exotic event.key values
  // ('MediaPlayPause', 'BrowserBack', IME keys) must stay bindable — but a
  // silently dead binding is exactly what this warning exists to prevent.
  console.warn(
    `[whichkey] key string "${input}": "${base}" is not a key name this library ` +
      'recognises; if the browser does not report exactly this value, the binding ' +
      'will never match.',
  );
  return base;
};
```

`'Space'` is deliberately the alias target: `parseKey` already maps a literal `' '` base to `'Space'`, and `eventToCanonical` maps `event.key === ' '` to `'Space'`, so `'space'` → `'Space'` round-trips.

- [ ] **Step 4: Call it from `parseKey`**

In `parseKey`, change:

```ts
const base = baseRaw === ' ' ? 'Space' : baseRaw;
```

to:

```ts
const base = baseRaw === ' ' ? 'Space' : normalizeBase(baseRaw, input);
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/keys.test.ts`
Expected: PASS, including every pre-existing canonicalization test. If a pre-existing test now fails, **stop and report** — that means the alias table changed a case that already worked, which the finding does not authorize.

- [ ] **Step 6: Check the whole suite for fallout**

`parseKey` is on the registration path for every consumer. Run the engine and React suites:

Run: `npx vitest run src/engine/ src/react/`
Expected: PASS. Watch particularly for tests registering `'Escape'` (already exact-cased, unaffected) and any test asserting a warning count, which a new warning could disturb.

- [ ] **Step 7: Document**

Add to the **Console warnings** table in `docs/API.md`:

```
| `key string "…": "<base>" is not a key name this library recognises` | A multi-character base that is not a known special key or `F1`–`F12`. | Use the exact `event.key` spelling. Common aliases (`esc`, `up`, `pgup`, `f1`) are accepted case-insensitively. |
```

In the **Key-string syntax** section, state that special-key names are accepted case-insensitively with the listed aliases, and that anything else is passed through verbatim with a warning.

- [ ] **Step 8: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`

- [ ] **Step 9: Strip B15 from `bughunt.md` and commit**

```bash
git add src/engine/keys.ts src/engine/__tests__/keys.test.ts docs/API.md bughunt.md
git commit -m "fix(correctness): accept case-insensitive special-key aliases and warn on unknown bases [B15]"
```

---

## Task 5: D1 — registry `version` counter for the cheatsheet model

**Files:**

- Modify: `src/engine/registry.ts` (add `version`, bump in every mutator)
- Modify: `src/react/ShortcutCheatsheet.tsx` (memoise the model)
- Modify: `docs/API.md` (document `registry.version`)
- Test: `src/engine/__tests__/registry.test.ts`, `src/react/__tests__/ShortcutCheatsheet.test.tsx`
- Modify: `bughunt.md` (strip the decision-needed blockquote **and** its `User Note` line)

**Interfaces:**

- Produces: `ShortcutRegistry.version: number` — a read-only monotonic counter, public because `ShortcutRegistry` is an exported class. **Task 6 must include it in the docs sweep.**

**The problem and the maintainer's decision.** `ShortcutCheatsheet` calls `engine.getCheatsheetModel()` in its render body, so a full registry scan plus bucketing plus sorts runs on every re-render. The vanilla renderer builds the model once at the open transition.

Two fixes were possible. A `useMemo` keyed on `visible` matches vanilla's semantics but makes the sheet a snapshot of open-time, so a late registration never appears. **The maintainer chose the `version` counter specifically to preserve freshness.** Implement that; do not substitute the simpler option.

**Do not put the model in the snapshot** — snapshots are deeply immutable and `getSnapshot()` must keep returning the cached object.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/registry.test.ts`:

```ts
describe('ShortcutRegistry.version [D1]', () => {
  it('starts at 0 and increments on every mutation', () => {
    const registry = new ShortcutRegistry();
    expect(registry.version).toBe(0);

    registry.register(entry({ id: 'a', keys: 'a' }));
    const afterRegister = registry.version;
    expect(afterRegister).toBeGreaterThan(0);

    registry.registerGroup({ id: 'g', prefix: 'g', description: 'Go', priority: 0, level: 0 });
    expect(registry.version).toBeGreaterThan(afterRegister);

    const afterGroup = registry.version;
    registry.activateLayer('l', 1, true);
    expect(registry.version).toBeGreaterThan(afterGroup);

    const afterActivate = registry.version;
    registry.deactivateLayer('l');
    expect(registry.version).toBeGreaterThan(afterActivate);

    const afterDeactivate = registry.version;
    registry.unregisterGroup('g');
    expect(registry.version).toBeGreaterThan(afterDeactivate);

    const afterUnregisterGroup = registry.version;
    registry.unregister('a');
    expect(registry.version).toBeGreaterThan(afterUnregisterGroup);
  });

  it('does not change on reads', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'a', keys: 'a' }));
    const v = registry.version;
    registry.getActive('a');
    registry.getAllActive();
    registry.getActiveCandidates('a');
    registry.getActiveGroup('a');
    expect(registry.version).toBe(v);
  });
});
```

Add to `src/react/__tests__/ShortcutCheatsheet.test.tsx` — the behaviour that actually matters:

```ts
it('does not rebuild the cheatsheet model when the registry has not changed [D1]', () => {
  // Read the file's existing helpers for rendering an open cheatsheet and
  // reuse them; this sketch names the intent, not the exact harness.
  const wk = createWhichKey({ helpKey: null });
  wk.register('q', vi.fn(), { description: 'Quit' });
  const spy = vi.spyOn(wk, 'getCheatsheetModel');

  const { rerender } = renderOpenCheatsheet(wk);
  const afterFirst = spy.mock.calls.length;

  rerender(<ShortcutCheatsheet />);
  rerender(<ShortcutCheatsheet />);
  expect(spy.mock.calls.length).toBe(afterFirst);
});

it('rebuilds when a late registration changes the registry [D1]', () => {
  const wk = createWhichKey({ helpKey: null });
  wk.register('q', vi.fn(), { description: 'Quit' });
  const { rerender, getByTestId } = renderOpenCheatsheet(wk);

  act(() => {
    wk.register('n', vi.fn(), { description: 'New' });
  });
  rerender(<ShortcutCheatsheet />);
  expect(getByTestId('whichkey-cheatsheet').textContent).toContain('New');
});
```

**Adapt both to the file's real harness** — read `ShortcutCheatsheet.test.tsx` first for how it renders an open sheet. The second test is the load-bearing one: it is what distinguishes the maintainer's chosen fix from the rejected `useMemo`-on-`visible`.

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/engine/__tests__/registry.test.ts src/react/__tests__/ShortcutCheatsheet.test.tsx -t "D1"`
Expected: the registry tests FAIL (`registry.version` is `undefined`), and the no-rebuild test FAILS (the spy is called once per render).

- [ ] **Step 3: Add `version` to the registry**

In `src/engine/registry.ts`, add the field beside `blockLevelCache`:

```ts
  // Monotonic, bumped by every mutator. Lets a consumer memoise derived views
  // (the React cheatsheet rebuilds a full scan + bucketing + sorts otherwise)
  // without making them stale: unlike keying on "is the sheet open", a late
  // registration still invalidates. Public because ShortcutRegistry is an
  // exported class — see docs/API.md.
  private _version = 0;

  get version(): number {
    return this._version;
  }
```

Then bump it as the **first statement** of every mutator — `register`, `unregister`, `registerGroup`, `unregisterGroup`, `activateLayer`, `deactivateLayer`:

```ts
this._version++;
```

**Invalidation must be exhaustive.** Before committing, run:

```bash
grep -n 'this\.shortcuts\.\(set\|delete\)\|this\.groups\.\(set\|delete\)\|this\.layers\.\(set\|delete\)\|\.splice(' src/engine/registry.ts
```

Every write site must sit inside a method that bumps. Note `register`/`unregister` mutate a bucket array via `splice` as well as the Map — a bump at the top of the method covers both. If you find a write in a method that does not bump, **report it** rather than quietly adding a bump; that would mean the mutator set is larger than this plan assumes.

- [ ] **Step 4: Memoise in the React cheatsheet**

In `src/react/ShortcutCheatsheet.tsx`, add `useMemo` to the React import, and replace the render-body call:

```ts
const model = engine.getCheatsheetModel();
```

with a memo keyed on the registry version. Because the early return `if (!engine || !visible) return null;` sits above, and hooks must run unconditionally, **read the version and memo before that return**:

```ts
// Read before the early return — hooks must run unconditionally.
const registryVersion = engine?.registry.version ?? 0;
const model = useMemo(
  () => engine?.getCheatsheetModel() ?? { standalone: [], groups: [] },
  [engine, registryVersion, visible],
);
```

`visible` stays in the deps so reopening the sheet re-derives even if nothing registered — cheap, and it keeps the sheet honest if a future change makes the model depend on open state.

Then move the existing early return below it and use `model` unchanged.

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/engine/__tests__/registry.test.ts src/react/__tests__/ShortcutCheatsheet.test.tsx`
Expected: PASS, including the pre-existing cheatsheet rendering tests.

- [ ] **Step 6: Confirm the ESLint hook rules are satisfied**

`eslint-plugin-react-hooks` v7 is enabled on `src/react/**` with the full recommended preset (including React-Compiler readiness rules). Run:

Run: `npx eslint src/react/ShortcutCheatsheet.tsx`
Expected: clean. If `exhaustive-deps` objects to the dep array, **read the rule's reasoning before suppressing** — one of these rules caught a real bug earlier in this project.

- [ ] **Step 7: Document `registry.version`**

In `docs/API.md`, under the `engine.registry` entry, document `version` as a read-only monotonic counter that changes on every registration, unregistration or layer change, and is intended for memoising derived views. Note it does **not** change on reads.

- [ ] **Step 8: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`

- [ ] **Step 9: Strip the marker from `bughunt.md` and commit**

Remove the `> **decision-needed (behavioral):** ShortcutCheatsheet rebuilds…` blockquote **and** the `- User Note: Use a registry version counter` line **and** its `- [x] execute [ ] skip` line.

```bash
git add src/engine/registry.ts src/react/ShortcutCheatsheet.tsx src/engine/__tests__/registry.test.ts src/react/__tests__/ShortcutCheatsheet.test.tsx docs/API.md bughunt.md
git commit -m "perf(react): memoise the cheatsheet model on a registry version counter [D1]"
```

> ### 🚩 Milestone after Task 5
>
> Run `npm test`. Expected green. On red: bisect within Tasks 4–5, revert the offender, surface the diagnosis.

---

## Task 6: B46 — document the remaining public exports

**Files:**

- Modify: `docs/API.md`
- Modify: `bughunt.md` (strip B46)

**Interfaces:**

- Consumes: `registry.version` from Task 5 — include it in the sweep.
- Produces: nothing code-level. Docs only.

**The gap.** `README.md` calls `docs/API.md` "the full reference", and `CLAUDE.md` states the rule: _"Anything public must be added to the relevant `index.ts` and to `docs/API.md`."_ Eight exports never appear in it:

| Symbol                                             | Exported from                               |
| -------------------------------------------------- | ------------------------------------------- |
| `WhichKeyContext`, `LayerContext`                  | `src/react/index.ts:3`                      |
| `alphabeticalKeysSort`                             | `src/engine/index.ts:6`                     |
| `isModifierOnlyEvent`, `isInputTarget`             | `src/engine/index.ts:2`                     |
| `CanonicalKey`, `ShortcutHandler`                  | `export * from './types'`                   |
| `SortMode` (and `WhichKeyPopupLayout`, same shape) | `export * from './types'` / `WhichKeyPopup` |

**Document all of them in this task.** The finding suggests deciding documented-or-unexported per symbol, but unexporting any is a `feat!:` break pre-1.0, and the decision-needed marker that would authorise such a break is explicitly **out of scope** for this batch. So: document each, and where a symbol looks like it should not be public long-term, say so plainly in its entry and leave the removal to that marker.

- [ ] **Step 1: Verify the list against the source**

Do not trust the table above — it was assembled during an earlier task. Re-derive:

```bash
grep -n '^export' src/engine/index.ts src/react/index.ts src/vanilla/index.ts src/engine/types.ts
```

For each named export, grep `docs/API.md` for it. Report any symbol the table misses or over-counts. An earlier version of this finding said "eight" while enumerating seven, so the count is not to be trusted.

- [ ] **Step 2: Add the entries**

Extend the existing **Debugging** section (added by B28) with `isModifierOnlyEvent` and `isInputTarget`, describing them accurately as matcher-internal predicates exported for advanced use, and noting they may be unexported before 1.0.

Add `alphabeticalKeysSort` next to the existing `sortKeys` material — it is the built-in comparator behind `sortKeys: 'alphabetical'`, and a consumer writing a custom `KeyComparator` may want to compose it.

Add a short **React escape hatches** entry for `WhichKeyContext` and `LayerContext`, stating what they are for (reading the engine or the current layer level from a custom component) and that most consumers should use the hooks instead.

Add type blocks for `CanonicalKey`, `ShortcutHandler`, `SortMode` and `WhichKeyPopupLayout` — all four already appear inside documented signatures, so give each a one-line definition and a pointer to where it is used.

Add `registry.version` (from Task 5) if Task 5 did not already land it.

- [ ] **Step 3: Verify no export is left undocumented**

Re-run the Step 1 sweep. Every named export from the three entry points must now appear in `docs/API.md`, **except** the five covered by the engine-internals decision-needed marker (`Matcher`, `MatcherOptions`, `ShortcutRegistry`, `resolveSort`, and the `ShortcutEntry`/`GroupEntry` shapes). Report the final tally.

- [ ] **Step 4: Check the TOC**

If you added an `##`-level section, add its TOC entry and renumber. **Add and renumber only — never rewrite an existing entry's text.** Several earlier tasks changed TOC entries to match renamed headings. The file's convention is that only `##`/`###` headings are listed; `####` method headings are not. Verify every anchor resolves.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`
Expected: green, test count unchanged at whatever Task 5 left it.

- [ ] **Step 6: Strip B46 from `bughunt.md` and commit**

```bash
git add docs/API.md bughunt.md
git commit -m "docs(api): document the remaining public exports [B46]"
```

---

## Task 7: D2 — `prefers-color-scheme` with an author override

**Files:**

- Modify: `src/styles.css` (all 15 colours)
- Modify: `src/react/WhichKeyPopup.tsx:13,41,65,93`
- Modify: `src/vanilla/popup.ts:9,47,52`
- Modify: `README.md` (Styling section)
- Modify: `docs/API.md` (theming contract)
- Test: `src/__tests__/styles-contract.test.ts`, and the seven sanctioned assertion updates below
- Modify: `bughunt.md` (strip the decision-needed blockquote **and** its `User Note` line)

**Interfaces:**

- Produces: `--wk-*` colour custom properties, and a `[data-wk-theme="light"|"dark"]` override attribute. Both become documented public API.

**RISK: HIGH — write the RED test first and commit it separately** as:

`test: characterize the dark-only theme before fix [D2]`

**The maintainer's direction:** _"Add support for an `@media` rule and use `prefers-color-scheme`, along with the ability for the author to override the preference."_

**The complication that makes this more than a CSS change.** Both renderers set the popup's background **inline from JavaScript**:

```ts
const PANEL_BG_RGB = '17, 24, 39'; // popup.ts:9, WhichKeyPopup.tsx:13
const bg = `rgba(${PANEL_BG_RGB}, ${clamp01(backgroundOpacity)})`; // popup.ts:47, WhichKeyPopup.tsx:93
el.style.backgroundColor = bg; // popup.ts:52, WhichKeyPopup.tsx:41,65
```

An inline style beats every CSS rule, so a pure-CSS light theme would leave the popup dark while everything around it turned light. The colour must move into CSS while the runtime opacity prop keeps working.

**Required shape:**

- All 15 colours become `--wk-*` custom properties, **dark as the default** so anyone who does nothing sees no change.
- `@media (prefers-color-scheme: light)` supplies the light palette.
- `[data-wk-theme="light"]` and `[data-wk-theme="dark"]` override the media query **in both directions**, so an author can force either theme regardless of OS preference. Scope them so they win: define the defaults on `:root`, guard the media block against an explicit dark opt-out, and let the attribute selectors come last.
- The popup emits **only the opacity** inline, as a custom property, and CSS composes the colour.

- [ ] **Step 1: Write the failing contract tests**

Add to `src/__tests__/styles-contract.test.ts` (created by B26; it already reads the stylesheet as text and explains why):

```ts
describe('styles.css — theming contract [D2]', () => {
  it('defines the palette as --wk-* custom properties', () => {
    expect(css).toMatch(/--wk-panel-bg\s*:/);
    expect(css).toMatch(/--wk-text\s*:/);
  });

  it('supplies a light palette under prefers-color-scheme: light', () => {
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*light\)/);
  });

  it('lets an author force either theme with data-wk-theme', () => {
    expect(css).toMatch(/\[data-wk-theme=['"]light['"]\]/);
    expect(css).toMatch(/\[data-wk-theme=['"]dark['"]\]/);
  });

  it('leaves no raw hex colour outside a custom-property declaration', () => {
    const offenders = css
      .split('\n')
      .filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line))
      .filter((line) => !/--wk-[\w-]+\s*:/.test(line))
      .filter((line) => !line.trim().startsWith('/*') && !line.trim().startsWith('*'));
    expect(offenders).toEqual([]);
  });
});
```

The last one is the load-bearing check: it fails if any colour stays hardcoded in a rule instead of moving to a property.

- [ ] **Step 2: Run to verify RED, then commit the test alone**

Run: `npx vitest run src/__tests__/styles-contract.test.ts -t "D2"`
Expected: all four FAIL against the current dark-only sheet.

```bash
git add src/__tests__/styles-contract.test.ts
git commit -m "test: characterize the dark-only theme before fix [D2]"
```

- [ ] **Step 3: Hoist the palette in `src/styles.css`**

Define the dark defaults on `:root`, then the light overrides. Name properties for their **role**, not their colour, so a light value under a name like `--wk-gray-700` does not become nonsense:

```css
/* Dark is the default: an existing consumer who does nothing sees no change.
   A light palette is supplied under prefers-color-scheme, and an author can
   force either theme with data-wk-theme on any ancestor (usually <html>). */
:root {
  --wk-panel-bg: #111827;
  --wk-panel-bg-rgb: 17, 24, 39;
  --wk-chip-bg: #374151;
  --wk-border: #374151;
  --wk-text: #f3f4f6;
  --wk-text-muted: #9ca3af;
  --wk-text-subtle: #6b7280;
  --wk-row-label: #e5e7eb;
  --wk-row-label-group: #93c5fd;
  --wk-focus-ring: #93c5fd;
  --wk-backdrop-bg: rgba(0, 0, 0, 0.5);
  --wk-shadow-chip: 0 1px 2px rgba(0, 0, 0, 0.05);
  --wk-shadow-panel: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: light) {
  :root:not([data-wk-theme='dark']) {
    --wk-panel-bg: #ffffff;
    --wk-panel-bg-rgb: 255, 255, 255;
    --wk-chip-bg: #f3f4f6;
    --wk-border: #d1d5db;
    --wk-text: #111827;
    --wk-text-muted: #4b5563;
    --wk-text-subtle: #6b7280;
    --wk-row-label: #1f2937;
    --wk-row-label-group: #1d4ed8;
    --wk-focus-ring: #1d4ed8;
    --wk-backdrop-bg: rgba(0, 0, 0, 0.35);
    --wk-shadow-chip: 0 1px 2px rgba(0, 0, 0, 0.08);
    --wk-shadow-panel: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.15);
  }
}

/* Explicit author override wins in both directions, regardless of OS setting.
   The light values are repeated verbatim here rather than shared: plain CSS
   has no way to reference one property block from two selectors, and the
   alternative — light-dark() with color-scheme — would silently raise this
   library's browser floor to Chrome 123 / Safari 17.5 / Firefox 120. The
   package declares no browserslist and no support policy, so raising the
   floor is the maintainer's call to make deliberately, not a side effect of
   a theming task. Do NOT substitute light-dark() here. */
:root[data-wk-theme='light'] {
  --wk-panel-bg: #ffffff;
  --wk-panel-bg-rgb: 255, 255, 255;
  --wk-chip-bg: #f3f4f6;
  --wk-border: #d1d5db;
  --wk-text: #111827;
  --wk-text-muted: #4b5563;
  --wk-text-subtle: #6b7280;
  --wk-row-label: #1f2937;
  --wk-row-label-group: #1d4ed8;
  --wk-focus-ring: #1d4ed8;
  --wk-backdrop-bg: rgba(0, 0, 0, 0.35);
  --wk-shadow-chip: 0 1px 2px rgba(0, 0, 0, 0.08);
  --wk-shadow-panel: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.15);
}
```

If the duplication bothers you, note it in your report as a follow-up rather
than restructuring — a `light-dark()` migration is a support-policy decision
that deserves its own finding.

The `:not([data-wk-theme='dark'])` guard is what makes `data-wk-theme="dark"` hold on a light-preferring OS; the trailing `[data-wk-theme='light']` block is what makes light hold on a dark-preferring OS. Both directions are required by the maintainer's direction — verify each with a test or a documented manual check, and say which you did.

Then replace every hardcoded colour in the rules with `var(--wk-…)`.

- [ ] **Step 4: Move the popup background out of inline JS**

In `src/styles.css`, give `.wk-popup` its background from the properties:

```css
.wk-popup {
  background: rgba(var(--wk-panel-bg-rgb), var(--wk-popup-bg-opacity, 0.95));
}
```

In `src/react/WhichKeyPopup.tsx`, delete `PANEL_BG_RGB` and change both `style={{ backgroundColor: bg }}` sites to set the custom property instead:

```tsx
style={{ '--wk-popup-bg-opacity': clamp01(backgroundOpacity) } as React.CSSProperties}
```

(The cast is needed because `CSSProperties` does not type custom properties. Keep it narrow and comment why — it is the repo's `no any without justification` rule in spirit.)

In `src/vanilla/popup.ts`, delete `PANEL_BG_RGB` and replace `el.style.backgroundColor = bg;` with:

```ts
el.style.setProperty('--wk-popup-bg-opacity', String(clamp01(opts.backgroundOpacity)));
```

`clamp01` still runs, so `DEFAULT_BACKGROUND_OPACITY` and the NaN fallback from B29 keep working.

- [ ] **Step 5: Update the seven sanctioned assertions**

These pin the exact inline value this task removes. Updating them is **sanctioned for this task only**:

- `src/react/__tests__/WhichKeyPopup.test.tsx:129, 146, 165, 182, 315, 454`
- `src/vanilla/__tests__/mount.test.ts:218`

Assert the new mechanism **with equal strictness** — each must still fail if the opacity prop stops reaching the element. For example, `expect(popup.style.getPropertyValue('--wk-popup-bg-opacity')).toBe('0.5')` rather than merely checking the property exists. **Do not weaken any of them to an existence check.** Note that the line asserting `'rgb(17, 24, 39)'` for opacity `1` was testing CSSOM normalisation of the composed string; its replacement should assert the opacity value `'1'`.

- [ ] **Step 6: Run to verify GREEN**

Run: `npx vitest run src/__tests__/ src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts`
Expected: PASS, including the class-contract guard.

- [ ] **Step 7: Check the class contract still holds**

If you added any class, add it to the `CONTRACT` array in `src/__tests__/class-contract.test.tsx` and to both doc tables — that file's own header states the rule. If you added none, confirm the guard is still green.

Run: `npx vitest run src/__tests__/class-contract.test.tsx`

- [ ] **Step 8: Document the theming contract**

In the **README Styling** section, add a "Theming" subsection: the sheet ships dark by default, follows `prefers-color-scheme` automatically, and an author forces a theme with `data-wk-theme="light"` or `"dark"` on `<html>` (or any ancestor). List the `--wk-*` properties in a table and show a worked override. Note the B26 `--wk-z-index` properties are part of the same custom-property surface.

Mirror a shorter version in `docs/API.md` beside the CSS class contract, and **remove or correct** anything that still describes the theme as dark-only.

- [ ] **Step 9: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run format:check`
Confirm `dist/styles.css` carries the change: `grep -c 'prefers-color-scheme' dist/styles.css`

- [ ] **Step 10: Strip the marker from `bughunt.md` and commit**

Remove the `> **decision-needed (API):** the shipped theme is dark-only…` blockquote, its `User Note:` line, and its `- [x] execute [ ] skip` line.

```bash
git add src/styles.css src/react/WhichKeyPopup.tsx src/vanilla/popup.ts README.md docs/API.md src/__tests__ src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts bughunt.md
git commit -m "feat(styling): follow prefers-color-scheme with a data-wk-theme override [D2]"
```

**Note the `feat:` type** — this is the one item in the batch that adds capability rather than fixing a defect, and it is a behavioural change for any consumer on a light-preferring OS.

> ### 🚩 Milestone after Task 7
>
> Run the full gate. Then update `bughunt.md`'s "Last triage" line to record this batch.

---

## Final verification

- [ ] **Step 1: Confirm `bughunt.md` holds exactly what it should**

```bash
grep -o '^### B[0-9]*' bughunt.md | tr '\n' ' '
grep -c '^> \*\*decision-needed' bughunt.md
grep -n 'User Note' bughunt.md
```

Expected: **only B41**; **5** decision-needed markers; **zero** `User Note` lines (both were consumed by Tasks 5 and 7).

- [ ] **Step 2: Update the "Last triage" line**

Record batch 3: the seven items executed on `codehealth/2026-08-22-batch3`, and what remains open.

- [ ] **Step 3: Final full gate**

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run format:check && npm pack --dry-run
```

Expected: lint 0/0; typecheck clean; all tests passing with coverage at or above the 80% gate on all four metrics; build green; tarball 18 files.

- [ ] **Step 4: Review the log**

```bash
git log --oneline codehealth/2026-08-21-batch2..HEAD
```

Expected: 7 item commits plus 1 `test:` characterization commit (D2), plus the selections/spec/plan commits. Each item commit's diff must touch `bughunt.md`.

## Definition of done

- All 7 items landed, one commit each, each stripping its own block (and for D1/D2 the blockquote plus its `User Note`).
- `bughunt.md` contains only the preamble with an updated "Last triage" line, **B41**, and the **five** remaining decision-needed markers.
- Every new `console.warn` appears in `docs/API.md`'s Console warnings table.
- Full gate green. No summary commit — the per-item commits are the audit trail.
