# code-health B14–B43 (Medium + Low) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 28 code-health findings the user selected from the Medium and Low buckets of `bughunt.md` — B14, B16–B40, B42, B43 — one commit per finding, each stripping its own finding block from `bughunt.md`.

**Architecture:** `which-key` is a framework-free keyboard-shortcut engine (`src/engine/`) with two interchangeable renderers over it: React (`src/react/`) and imperative DOM (`src/vanilla/`). Fixes land in dependency order — the lint gate first so it guards every later edit, then engine internals (matcher → registry → controller → keys), then the renderers that read them, then packaging, then docs last so the docs describe final behaviour. Most fixes are surgical: replace a synthesized value with the real one, add a validation guard that warns instead of throwing, cache an invariant, or add a missing export/CSS rule.

**Tech Stack:** TypeScript 5.7 (strict, `noUnusedLocals`/`noUnusedParameters`), React 19, Vitest 2 + jsdom + Testing Library, ESLint 9 flat config, tsup (dual ESM+CJS + `.d.ts`), Node 24.19.0.

**Spec:** `docs/superpowers/specs/2026-08-21-codehealth-medium-low-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Branch:** `codehealth/2026-08-21-batch2`, off `main` @ 09bee08 (v0.2.0).
- **Out of scope, never touch:** **B15** and **B41** in `bughunt.md` (user left them unchecked) and the **7 `decision-needed` markers**. Do not fix them, do not strip them.
- **Line numbers in `bughunt.md` are stale** (written before B1–B13 landed). Locate code by the **named symbol**, never by the cited line. Confirmed drift: B17 cites `matcher.ts:62` for code now at `matcher.ts:98`; B21 cites `54`/`73` for branches now at `88`/`108`.
- **Baseline at 09bee08:** typecheck clean, build green, **244 tests passing in 19 files**, coverage 98.83% lines / 94.58% branches. `npm run lint` has **2 preexisting warnings**, both `Unused eslint-disable directive` in generated `coverage/` output — Task 1 clears them.
- **Verification command, run at the end of every task:** `npm run lint && npm run typecheck && npm test && npm run build`. All four must be green. No `--no-verify`, no `--allow-dirty`, no `--force`.
- **Run a single test file** with `npx vitest run <path>`, never `npm test` — coverage is configured `all: true` over `src/**`, so a partial run trips the 80% thresholds.
- **TDD.** Tests live in `__tests__/` beside the source. **Seven tasks are `risk: high` and MUST open with a RED characterization test committed separately** as `test: characterize <unit> before fix [B<n>]`: **Tasks 2 (B17), 11 (B30), 12 (B34), 15 (B24), 17 (B18), 18 (B26), 20 (B32)**.
- **Test files are never a fix target.** Add NEW tests; do not refactor existing ones. Two sanctioned exceptions, both because the existing assertion pins the behaviour being corrected: **Task 2 (B17)** tightening `expect.any(KeyboardEvent)` in `matcher.test.ts`, and **Task 1 (B27)** adding a scoped ESLint override for `src/react/__tests__/`.
- **Soft-failure is the library's convention for consumer misuse.** `useShortcut` already `console.warn`s on a missing provider rather than throwing. Tasks 8, 9, 10, 11, 12, 20, 21 extend that convention. **None may start throwing, and none may change a public return type.**
- **Warning message format:** every warning starts with the literal prefix `[whichkey] `. Task 28 greps for them all and documents each verbatim, so word them as final consumer-facing copy.
- **Named exports only.** Anything public must be added to the relevant `index.ts` _and_ to `docs/API.md`.
- **`src/engine/` stays framework-free.** Its only DOM touchpoints are the default `target = document` and the `navigator.platform` check in `isMacPlatform`.
- **No `any` without justification.** Strict TS with `noUnusedLocals`/`noUnusedParameters`.
- **Conventional Commits** are enforced by the husky `commit-msg` hook.
- **Every fix commit strips its own finding's entire block from `bughunt.md`** — the `### B<n>. …` heading line, every bullet, and the `- [x] execute   [ ] skip` line. Non-negotiable.
- **Milestone full-suite runs** after Tasks 5, 10, 15, 20, 25 and at the end. On red: bisect within the batch, revert the offender, surface the diagnosis.

## File Structure

**Created:**

- `src/shared/clamp.ts` — internal (unpublished) home for `clamp01`/`clampRows`, shared by both renderers so the two copies cannot drift. Task 16.
- `src/__tests__/styles-contract.test.ts` — reads `src/styles.css` as text and asserts the stylesheet contract: the `z-index` custom properties (Task 18) and that every `wk-*` class either renderer emits has a rule (Task 19). Follows the existing `src/engine/__tests__/package-exports.test.ts` precedent of asserting over file contents.

**Modified:**

| File                                                                                                                    | Tasks                                  | Responsibility after this batch                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint.config.js`                                                                                                      | 1                                      | Adds jsx-a11y + react-hooks scoped to `src/react/**/*.tsx`; ignores `coverage`.                                                                   |
| `src/engine/matcher.ts`                                                                                                 | 2, 3, 4, 5                             | Buffer + timers. Fires the real event, refreshes the popup on every buffer commit, computes the prospective leaf once, nulls fired timer handles. |
| `src/engine/registry.ts`                                                                                                | 6, 7                                   | Priority-sorted buckets. Candidate dedup merges instead of dropping; `blockLevel()` is cached and invalidated on layer changes.                   |
| `src/engine/controller.ts`                                                                                              | 8, 9, 10, 11, 12, 13                   | Public engine surface. `register`/`registerGroup`/`helpKey`/`timeoutMs`/`pushLayer` all soft-fail on misuse; cheatsheet keeps group labels.       |
| `src/engine/keys.ts`                                                                                                    | 14                                     | Canonicalization. `isMacPlatform` survives an absent `navigator`.                                                                                 |
| `src/react/context.ts`                                                                                                  | 15                                     | Adds the shared deduped `warnNoProvider` helper.                                                                                                  |
| `src/react/useWhichKeyState.ts`, `ShortcutCheatsheet.tsx`, `useShortcut.ts`, `useShortcutGroup.ts`, `WhichKeyLayer.tsx` | 15                                     | All five route their missing-provider diagnostic through `warnNoProvider`.                                                                        |
| `src/react/WhichKeyPopup.tsx`                                                                                           | 16                                     | Imports the shared clamps instead of defining its own.                                                                                            |
| `src/vanilla/popup.ts`                                                                                                  | 16                                     | Same.                                                                                                                                             |
| `src/vanilla/mount.ts`                                                                                                  | 17, 20, 21, 22                         | Stable popup host; double-mount guard; `classPrefix` validation; exports `WhichKeyMountHandle`.                                                   |
| `src/vanilla/index.ts`                                                                                                  | 22                                     | Re-exports `PopupOptions` and `WhichKeyMountHandle`.                                                                                              |
| `src/styles.css`                                                                                                        | 18, 19                                 | `z-index` via custom properties; defines `.wk-cheatsheet__section`.                                                                               |
| `examples/vanilla/index.html`                                                                                           | 23                                     | Demo stylesheet matches the real class contract.                                                                                                  |
| `.npmignore` (deleted), `README.md`                                                                                     | 24                                     | `files` becomes the single source of truth; README's API link is absolute.                                                                        |
| `docs/API.md`                                                                                                           | 10, 11, 12, 16, 21, 22, 25, 26, 27, 28 | The maintained full reference: layers API, corrected option tables, Debugging section, warning reference.                                         |
| `README.md`                                                                                                             | 18, 24, 27, 28                         | Styling section documents the z-index variables and the `classPrefix` opt-out; new Troubleshooting section.                                       |
| `bughunt.md`                                                                                                            | every task                             | Shrinks by one finding block per commit.                                                                                                          |

---

## Group 1 — lint gate

### Task 1: B27 — add jsx-a11y and react-hooks ESLint plugins

**Files:**

- Modify: `eslint.config.js:1-6` (the whole file)
- Modify: `package.json` (devDependencies)
- Modify: `bughunt.md` (strip B27)

**Interfaces:**

- Consumes: nothing.
- Produces: a clean `npm run lint` (0 errors, 0 warnings) that every later task verifies against. Later React tasks (15, 16) will be checked by `react-hooks/exhaustive-deps` and `jsx-a11y`.

**Why first:** this is the gate every later React and vanilla edit is measured by. `bughunt.md` warned "Expect B3 and B7 to light up" — both already landed in the B1–B13 batch, so expect few or no new errors.

- [ ] **Step 1: Install the two plugins**

```bash
npm install --save-dev eslint-plugin-jsx-a11y eslint-plugin-react-hooks
```

- [ ] **Step 2: See what the plugins would flag before wiring them in**

Write the new config, then run lint once to inventory the damage before deciding how to handle it.

Replace the whole of `eslint.config.js` with:

```js
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'examples', 'coverage'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/react/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['src/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
```

Note: `coverage` is added to `ignores` — that is what clears the two baseline `Unused eslint-disable directive` warnings in generated `coverage/block-navigation.js`, so the rest of the batch runs against a clean gate.

If either plugin's flat-config export shape differs from the above on the installed version, read `node_modules/eslint-plugin-jsx-a11y/lib/index.js` and `node_modules/eslint-plugin-react-hooks/index.js` to find the right export (`flatConfigs.recommended` vs `configs.recommended` vs `configs['flat/recommended']`) rather than guessing.

- [ ] **Step 3: Run lint and triage**

Run: `npm run lint`
Expected: either clean, or a list of findings in `src/react/`.

Triage rule:

- Findings in `src/react/*.tsx` production source → **fix them**; they are in scope.
- Findings in `src/react/__tests__/` → **add a scoped override**, do not rewrite the tests (sanctioned exception in the Global Constraints). Append to the config:

```js
  {
    files: ['src/react/__tests__/**/*.{ts,tsx}'],
    rules: { 'react-hooks/rules-of-hooks': 'off', 'react-hooks/exhaustive-deps': 'off' },
  },
```

- One likely real finding: `ShortcutCheatsheet.tsx:57` puts `onClick` on a plain `<div className="wk-backdrop">`. If `jsx-a11y/no-static-element-interactions` or `click-events-have-key-events` fires there, the correct fix is a targeted `// eslint-disable-next-line` **with a comment explaining why** — the backdrop is a click-to-dismiss affordance whose keyboard equivalent is the Escape handler already installed in the `useEffect` above it, and the panel itself is the focus target. Do not add a `role="button"` or `tabIndex` to the backdrop; that would put a bogus stop in the tab order inside a modal that already implements a focus trap.

- [ ] **Step 4: Verify the whole gate**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: lint reports **0 errors and 0 warnings**; 244 tests still pass; build green.

- [ ] **Step 5: Strip B27 from bughunt.md**

Delete the entire `### B27. eslint config lacks jsx-a11y and react-hooks plugins…` block — heading, all bullets, and the `- [x] execute   [ ] skip` line.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js package.json package-lock.json bughunt.md
git commit -m "chore(lint): add jsx-a11y and react-hooks eslint plugins [B27]"
```

---

## Group 2 — engine: matcher

### Task 2: B17 — pass the real triggering event to a timed-out leaf-and-prefix handler

**Files:**

- Modify: `src/engine/matcher.ts` — the leaf-AND-prefix branch, `if (leaf && hasCandidates)` (currently lines 88–106)
- Test: `src/engine/__tests__/matcher.test.ts` (add new tests; tighten the existing `expect.any(KeyboardEvent)` at line 246)
- Modify: `bughunt.md` (strip B17)

**Interfaces:**

- Consumes: `MatcherOptions.onFire(entry: ShortcutEntry, event: KeyboardEvent)` — unchanged signature.
- Produces: the event handed to `onFire` from the timeout path is now the **same object** as the triggering `KeyboardEvent`, so `target`, `ctrlKey`/`shiftKey`/`altKey`/`metaKey`, and `cancelable` are all accurate.

**The bug:** the timeout callback builds `new KeyboardEvent('keydown', { key })` (matcher.ts:98). Because that event is never dispatched, `target` is `null`, `cancelable` is `false` so `preventDefault()` silently no-ops, and every modifier flag reads `false` — even though they were held. So an identical handler behaves differently depending on whether the shortcut happened to also be a prefix and whether the user waited out the timeout. The real event is already in scope (the branch already captures `eventTarget` into `fireTarget`).

**RISK: HIGH — write the RED test first and commit it separately.**

- [ ] **Step 1: Write the failing characterization test**

Add to `src/engine/__tests__/matcher.test.ts`, inside the existing describe block that covers the leaf-and-prefix timeout (search for the test that asserts `onFire` after `vi.advanceTimersByTime`):

```ts
describe('Matcher — leaf-AND-prefix timeout event fidelity [B17]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands the handler the real triggering event, not a synthetic one', () => {
    const onFire = vi.fn<FireFn>();
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    const leaf = entry({ id: 'leaf', keys: 'Ctrl+G' });
    registry.register(leaf);
    registry.register(entry({ id: 'deeper', keys: 'Ctrl+G h' }));

    const target = document.createElement('div');
    const triggering = ev({ key: 'g', ctrlKey: true, cancelable: true }, target);
    matcher.handleKeyDown(triggering);
    vi.advanceTimersByTime(500);

    expect(onFire).toHaveBeenCalledOnce();
    const fired = onFire.mock.calls[0][1];
    expect(fired).toBe(triggering);
    expect(fired.target).toBe(target);
    expect(fired.ctrlKey).toBe(true);
    expect(fired.cancelable).toBe(true);
  });

  it('lets the handler actually preventDefault the timed-out event', () => {
    const onFire = vi.fn<FireFn>((_e, event) => event.preventDefault());
    const { registry, matcher } = buildMatcher({ onFire }, 500);
    registry.register(entry({ id: 'leaf', keys: 'g' }));
    registry.register(entry({ id: 'deeper', keys: 'g h' }));

    const triggering = ev({ key: 'g', cancelable: true }, document.createElement('div'));
    matcher.handleKeyDown(triggering);
    vi.advanceTimersByTime(500);

    expect(triggering.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it FAILS (RED)**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts -t "B17"`
Expected: **FAIL**. First test fails at `expect(fired).toBe(triggering)` (it is a different, synthetic object) and reports `target: null, ctrlKey: false, cancelable: false`. Second test fails because `defaultPrevented` stays `false` — `preventDefault()` on a non-dispatched, non-cancelable event is a no-op.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/engine/__tests__/matcher.test.ts
git commit -m "test: characterize the leaf-and-prefix timeout event before fix [B17]"
```

- [ ] **Step 4: Apply the fix**

In `src/engine/matcher.ts`, in the `if (leaf && hasCandidates)` branch, capture the event alongside the target and pass it through. Change:

```ts
const fireTarget = eventTarget;
this.timer = setTimeout(() => {
  if (!leaf.enableOnInputs && isInputTarget(fireTarget)) {
    this.resetBuffer();
    return;
  }
  const synthetic = new KeyboardEvent('keydown', { key });
  try {
    this.options.onFire(leaf, synthetic);
  } finally {
    this.resetBuffer();
  }
}, this.options.timeoutMs);
```

to:

```ts
const fireTarget = eventTarget;
// Fire the ORIGINAL event, never a synthesized one. A `new
// KeyboardEvent(...)` that is never dispatched has target === null,
// cancelable === false (so preventDefault() silently no-ops) and all
// modifier flags false — so an identical handler would behave
// differently purely because this shortcut also happens to be a prefix.
const fireEvent = event;
this.timer = setTimeout(() => {
  if (!leaf.enableOnInputs && isInputTarget(fireTarget)) {
    this.resetBuffer();
    return;
  }
  try {
    this.options.onFire(leaf, fireEvent);
  } finally {
    this.resetBuffer();
  }
}, this.options.timeoutMs);
```

Note `key` may now be unused in this branch — `noUnusedLocals` only flags declarations, and `key` is still used earlier in `handleKeyDown`, so no further change is needed. Verify with typecheck.

- [ ] **Step 5: Tighten the existing loose assertion (sanctioned exception)**

At `src/engine/__tests__/matcher.test.ts:246` the timeout test asserts `expect(onFire).toHaveBeenCalledWith(leaf, expect.any(KeyboardEvent))` — which passed against the synthetic event and is exactly why this shipped. Read the surrounding test to find the variable holding the dispatched event and tighten to assert identity with it. If the test does not keep a reference to the event it dispatched, hoist it into a local first. Leave the other five `expect.any(KeyboardEvent)` sites alone — they are on paths that already receive the real event.

- [ ] **Step 6: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts`
Expected: PASS, including both B17 tests and the tightened assertion.

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Strip B17 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts src/engine/__tests__/matcher.test.ts bughunt.md
git commit -m "fix(correctness): pass the real triggering event to a timed-out leaf-and-prefix handler [B17]"
```

---

### Task 3: B21 — refresh the popup when a leaf-and-prefix keystroke commits

**Files:**

- Modify: `src/engine/matcher.ts` — the `if (leaf && hasCandidates)` branch (after Task 2's edit)
- Test: `src/engine/__tests__/matcher.test.ts`
- Modify: `bughunt.md` (strip B21)

**Interfaces:**

- Consumes: `MatcherOptions.onShowPopup(state: { currentSequence: string[] })`, and the private `this.popupVisible` / `this.bufferTouchedInput` fields.
- Produces: no signature change. The popup snapshot now tracks the buffer through the leaf-and-prefix wait.

**The bug:** the leaf-AND-prefix branch commits the new buffer but never calls `onShowPopup`, while the prefix-only branch _does_ refresh when the popup is already visible. With `g h` (leaf) + `g h x` + `g p` registered and `timeoutMs=50`: after `g` + timeout the snapshot reads `visible=true seq=['g'] cands=['h','p']`; immediately after pressing `h` it is **still** `seq=['g'] cands=['h','p']` even though the buffer is now `[g,h]` and the only real continuation is `x`. The user sees the wrong prompt for the whole timeout window, and `p` is advertised as pressable when it will abort the sequence.

**Interaction you must respect:** the prefix-only branch guards its `onShowPopup` behind `if (this.bufferTouchedInput) { … return; }` — the input-echo latch that stops buffered keystrokes typed into a text field from being painted on screen (see the long comment at `matcher.ts:12-28` and `:34-41`). The new refresh must honour the same latch.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/matcher.test.ts`:

```ts
describe('Matcher — popup freshness during the leaf-AND-prefix wait [B21]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('refreshes the visible popup when a leaf-AND-prefix key commits', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h' }));
    registry.register(entry({ id: 'ghx', keys: 'g h x' }));
    registry.register(entry({ id: 'gp', keys: 'g p' }));

    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(50);
    expect(onShowPopup).toHaveBeenLastCalledWith({ currentSequence: ['g'] });

    onShowPopup.mockClear();
    matcher.handleKeyDown(ev({ key: 'h' }));
    expect(onShowPopup).toHaveBeenCalledOnce();
    expect(onShowPopup).toHaveBeenLastCalledWith({ currentSequence: ['g', 'h'] });
  });

  it('does not refresh when the popup is not yet visible', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h' }));
    registry.register(entry({ id: 'ghx', keys: 'g h x' }));

    matcher.handleKeyDown(ev({ key: 'g' }));
    matcher.handleKeyDown(ev({ key: 'h' }));
    expect(onShowPopup).not.toHaveBeenCalled();
  });

  it('never surfaces a buffer tainted by a character echoed into a text field', () => {
    const onShowPopup = vi.fn<ShowFn>();
    const onHidePopup = vi.fn<HideFn>();
    const { registry, matcher } = buildMatcher({ onShowPopup, onHidePopup }, 50);
    registry.register(entry({ id: 'gh', keys: 'g h', enableOnInputs: true }));
    registry.register(entry({ id: 'ghx', keys: 'g h x', enableOnInputs: true }));
    registry.register(entry({ id: 'gp', keys: 'g p', enableOnInputs: true }));

    const input = document.createElement('input');
    matcher.handleKeyDown(ev({ key: 'g' }));
    vi.advanceTimersByTime(50);
    onShowPopup.mockClear();

    // 'h' typed into a text field echoes a character — the latch must hold.
    matcher.handleKeyDown(ev({ key: 'h' }, input));
    expect(onShowPopup).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts -t "B21"`
Expected: the first test FAILS — `onShowPopup` is not called at all after `h`. The second and third should already pass (they pin behaviour the fix must not break).

- [ ] **Step 3: Apply the fix**

In the `if (leaf && hasCandidates)` branch, after `this.commitBuffer(...)` and `this.clearTimer()`, add the latch-respecting refresh. The branch head becomes:

```ts
    if (leaf && hasCandidates) {
      // Leaf-AND-prefix — commit buffer, start timer to fire leaf if no continuation.
      this.commitBuffer(prospective, isInputTarget(eventTarget) && echoesCharacter(event));
      this.clearTimer();
      // Mirror the prefix-only branch: if the popup is already up it must
      // track the buffer, or it advertises the PREVIOUS prefix's candidates
      // for the whole timeout window — keys that would now abort the
      // sequence. Same input-echo latch applies: never paint a buffer that
      // echoed characters into a text field.
      if (this.popupVisible && !this.bufferTouchedInput) {
        this.options.onShowPopup({ currentSequence: [...this.buffer] });
      }
      const fireTarget = eventTarget;
      // ... rest unchanged from Task 2
```

Note `[...this.buffer]` — a defensive copy, never the live array. The controller copies again, but the Matcher must not hand out its internal buffer (see the snapshot-immutability invariant in `CLAUDE.md`).

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts`
Expected: PASS, all three B21 tests plus the pre-existing suite.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Strip B21 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts src/engine/__tests__/matcher.test.ts bughunt.md
git commit -m "fix(correctness): refresh the popup when a leaf-and-prefix keystroke commits [B21]"
```

---

### Task 4: B38 — compute the prospective leaf once per event

**Files:**

- Modify: `src/engine/matcher.ts:62-71` (the Escape guard and the `leaf` lookup below it)
- Modify: `bughunt.md` (strip B38)

**Interfaces:**

- Consumes: `ShortcutRegistry.getActive(keys)`.
- Produces: no behaviour change whatsoever. Pure de-duplication.

**The bug:** line 63 computes `const escapeLeaf = this.registry.getActive(prospectiveKeys)`; if truthy, control falls through to line 70 which recomputes the byte-identical `this.registry.getActive(prospectiveKeys)` into `leaf`. Each call is a `Map.get` plus `findActive`, and `findActive` itself runs a full `blockLevel()` scan (which Task 7 caches, but the duplicate call is still free to remove).

- [ ] **Step 1: Apply the fix**

Replace:

```ts
// Escape cancels a partial sequence unless an explicit Escape leaf is registered for the prospective.
if (this.buffer.length > 0 && key === 'Escape') {
  const escapeLeaf = this.registry.getActive(prospectiveKeys);
  if (!escapeLeaf) {
    this.cancel();
    return;
  }
}

const leaf = this.registry.getActive(prospectiveKeys);
```

with:

```ts
const leaf = this.registry.getActive(prospectiveKeys);

// Escape cancels a partial sequence unless an explicit Escape leaf is
// registered for the prospective sequence.
if (this.buffer.length > 0 && key === 'Escape' && !leaf) {
  this.cancel();
  return;
}
```

- [ ] **Step 2: Verify behaviour is unchanged**

The existing Escape tests are the guard — this is a pure refactor with no new test.

Run: `npx vitest run src/engine/__tests__/matcher.test.ts`
Expected: PASS with no changes to any test file.

Sanity-check the equivalence by reading: the original cancels iff `buffer.length > 0 && key === 'Escape' && !getActive(prospectiveKeys)`; the new guard is the same predicate with the lookup hoisted. Hoisting is safe because `getActive` is a pure read — it mutates nothing.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 4: Strip B38 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts bughunt.md
git commit -m "perf(matcher): compute the prospective leaf once per event [B38]"
```

---

### Task 5: B42 — clear the fired timer handle in the popup-show callback

**Files:**

- Modify: `src/engine/matcher.ts` — the `setTimeout` callback in the prefix-only branch (currently line 133)
- Modify: `bughunt.md` (strip B42)

**Interfaces:**

- Consumes/Produces: nothing public. Restores the internal invariant that `this.timer !== null` means "a timer is pending".

**The bug:** the prefix-only branch assigns `this.timer = setTimeout(...)`, but the callback sets `popupVisible` and calls `onShowPopup` without clearing `this.timer`. Unlike the leaf-and-prefix branch (which ends in `resetBuffer` → `clearTimer`), this path leaves an already-fired Timeout object referenced by the Matcher for as long as the popup stays open. No correctness bug and no unbounded growth — at most one stale handle — but it makes `this.timer !== null` an unreliable signal, which blocks using that condition in any future guard.

- [ ] **Step 1: Apply the fix**

Change:

```ts
this.timer = setTimeout(() => {
  this.popupVisible = true;
  this.options.onShowPopup({ currentSequence: [...this.buffer] });
}, this.options.timeoutMs);
```

to:

```ts
this.timer = setTimeout(() => {
  // Maintain clearTimer()'s invariant: a non-null this.timer means a
  // timer is still pending. This one just fired.
  this.timer = null;
  this.popupVisible = true;
  this.options.onShowPopup({ currentSequence: [...this.buffer] });
}, this.options.timeoutMs);
```

- [ ] **Step 2: Verify nothing regressed**

Run: `npx vitest run src/engine/__tests__/matcher.test.ts`
Expected: PASS. `clearTimer()` already null-guards, so clearing early is safe on every subsequent path.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 4: Strip B42 from bughunt.md and commit**

```bash
git add src/engine/matcher.ts bughunt.md
git commit -m "fix(matcher): clear the fired timer handle in the popup-show callback [B42]"
```

> ### 🚩 Milestone after Task 5
>
> Run the full suite: `npm test`. Expected green with all four matcher findings landed. On red: bisect within Tasks 2–5, revert the offender, surface the diagnosis before continuing.

---

## Group 3 — engine: registry

### Task 6: B20 — merge colliding leaf and deeper-sequence candidates

**Files:**

- Modify: `src/engine/registry.ts:129-152` (`getActiveCandidates`)
- Test: `src/engine/__tests__/registry.test.ts`
- Modify: `bughunt.md` (strip B20)

**Interfaces:**

- Consumes: `WhichKeyCandidate` from `src/engine/types.ts` — `{ keys: string; nextKey: string; description: string | undefined; isGroup: boolean }`.
- Produces: `getActiveCandidates(prefix)` output is now **registration-order independent**. For a `nextKey` that is both a leaf and the head of a deeper sequence, exactly one candidate is emitted with `isGroup: true`, `keys` set to the sub-prefix, and a description that prefers the registered group label, then the previously-seen candidate's description, then the leaf's own.

**The bug (empirically confirmed):** `candidateKey` is the full key string for a leaf but `prefix + ' ' + nextKey` for a deeper sequence — so for a leaf `g h` and a deeper `g h i` both evaluate to `'g h'`, the `seen` Map drops whichever arrives second, and **registration order decides the output**:

- `['g h','g h i']` → `[{keys:'g h', nextKey:'h', isGroup:false}]` — the whole `g h i` subtree is invisible and the row looks like a terminal action.
- `['g h i','g h']` → `[{keys:'g h', nextKey:'h', isGroup:true}]` — the leaf's own description is silently lost.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/registry.test.ts`. Match the existing file's helper conventions — read the top of the file for its `entry()` factory before writing.

```ts
describe('ShortcutRegistry.getActiveCandidates — leaf/deeper collisions [B20]', () => {
  const build = (order: Array<[string, string]>) => {
    const registry = new ShortcutRegistry();
    order.forEach(([keys, description], i) =>
      registry.register(entry({ id: `e${i}`, keys, description })),
    );
    return registry;
  };

  it('emits one merged group candidate regardless of registration order', () => {
    const forward = build([
      ['g h', 'Leaf label'],
      ['g h i', 'Deeper'],
    ]);
    const reverse = build([
      ['g h i', 'Deeper'],
      ['g h', 'Leaf label'],
    ]);

    for (const registry of [forward, reverse]) {
      const candidates = registry.getActiveCandidates('g');
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toEqual({
        keys: 'g h',
        nextKey: 'h',
        description: 'Leaf label',
        isGroup: true,
      });
    }
  });

  it('prefers a registered group label over the leaf description', () => {
    const registry = build([
      ['g h', 'Leaf label'],
      ['g h i', 'Deeper'],
    ]);
    registry.registerGroup({
      id: 'grp',
      prefix: 'g h',
      description: 'Group label',
      priority: 0,
      level: 0,
    });
    expect(registry.getActiveCandidates('g')[0].description).toBe('Group label');
  });

  it('still emits a plain leaf candidate when no deeper sequence exists', () => {
    const registry = build([['g h', 'Leaf label']]);
    expect(registry.getActiveCandidates('g')).toEqual([
      { keys: 'g h', nextKey: 'h', description: 'Leaf label', isGroup: false },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/registry.test.ts -t "B20"`
Expected: the first test FAILS — the two orders produce different objects (`isGroup` differs, and the reverse order loses `description`).

- [ ] **Step 3: Apply the fix**

Replace the body of `getActiveCandidates`:

```ts
  getActiveCandidates(prefix: string): WhichKeyCandidate[] {
    const prefixWithSpace = prefix + ' ';
    // Keyed by nextKey alone. A leaf `g h` and a deeper `g h i` are the SAME
    // row in the popup — the user presses one key. Keying by the full key
    // string for leaves but by the sub-prefix for deeper sequences made the
    // two collide on 'g h' and silently dropped whichever registered second,
    // so the output depended on registration order.
    const seen = new Map<string, WhichKeyCandidate>();
    for (const [keys, bucket] of this.shortcuts) {
      if (!keys.startsWith(prefixWithSpace)) continue;
      const top = this.findActive(bucket);
      if (!top) continue;
      const remainder = keys.slice(prefixWithSpace.length);
      const firstSpace = remainder.indexOf(' ');
      const isGroup = firstSpace >= 0;
      const nextKey = isGroup ? remainder.slice(0, firstSpace) : remainder;
      const subPrefix = prefixWithSpace + nextKey;
      const existing = seen.get(nextKey);
      // Merge rather than skip: once ANY deeper continuation exists for this
      // nextKey the row is a group, and the description falls back through
      // group label -> whatever we already had -> this entry's own label, so
      // a leaf's label survives when no group label is registered.
      seen.set(nextKey, {
        keys: subPrefix,
        nextKey,
        description:
          this.getActiveGroup(subPrefix)?.description ?? existing?.description ?? top.description,
        isGroup: isGroup || (existing?.isGroup ?? false),
      });
    }
    return Array.from(seen.values());
  }
```

Note `keys` is now always `subPrefix` (`prefix + ' ' + nextKey`). For a pure leaf that is identical to the full key string the old code emitted, so nothing changes for the non-colliding case — confirm with the third test.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/registry.test.ts`
Expected: PASS, including the pre-existing leaf-only and group-only coverage.

- [ ] **Step 5: Check the downstream consumers still render correctly**

`getActiveCandidates` feeds `controller.computeCandidates` → both renderers. Run their suites:

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts`
Expected: PASS.

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B20 from bughunt.md and commit**

```bash
git add src/engine/registry.ts src/engine/__tests__/registry.test.ts bughunt.md
git commit -m "fix(correctness): merge colliding leaf and deeper-sequence candidates [B20]"
```

---

### Task 7: B19 — cache blockLevel and invalidate on layer changes

**Files:**

- Modify: `src/engine/registry.ts:6-28` (fields, `activateLayer`, `deactivateLayer`, `blockLevel`)
- Test: `src/engine/__tests__/registry.test.ts` or `src/engine/__tests__/layers.test.ts`
- Modify: `bughunt.md` (strip B19)

**Interfaces:**

- Consumes: the private `this.layers` Map.
- Produces: `blockLevel()` is O(1) after the first call per layer-configuration. No public signature change.

**The bug:** `blockLevel()` iterates all active layers and is called from `findActive` and `getActiveGroup`, both invoked in loops. `getActiveCandidates` calls `findActive` per matching bucket and `getActiveGroup` per group candidate; `getAllActive` calls `findActive` for **every** bucket. So one `getAllActive()` over N keys costs N full layer scans, and `buildCheatsheetModel` adds one more per group. The value is invariant for the whole call — it changes only on `activateLayer`/`deactivateLayer`.

**Correctness requirement:** invalidation must be exhaustive. Before writing the cache, grep to confirm nothing else writes `this.layers`:

```bash
grep -n 'this\.layers' src/engine/registry.ts
```

Expected hits only in the field declaration, `activateLayer` (`.set`), `deactivateLayer` (`.delete`), `nextLevel` (read), and `blockLevel` (read). If any other mutator appears, it must invalidate too.

- [ ] **Step 1: Write the failing test**

The risk this fix introduces is a _stale_ cache, so the test must pin invalidation, not speed. Add to `src/engine/__tests__/layers.test.ts` (read its existing helpers first):

```ts
describe('ShortcutRegistry.blockLevel caching [B19]', () => {
  it('reflects a layer activated after an earlier lookup', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'base', keys: 'z', level: 0 }));
    expect(registry.getActive('z')).toBeDefined();

    registry.activateLayer('modal', 1, true);
    expect(registry.getActive('z')).toBeUndefined();

    registry.deactivateLayer('modal');
    expect(registry.getActive('z')).toBeDefined();
  });

  it('reflects a layer whose exclusivity changes under the same id', () => {
    const registry = new ShortcutRegistry();
    registry.register(entry({ id: 'base', keys: 'z', level: 0 }));
    registry.activateLayer('l', 1, false);
    expect(registry.getActive('z')).toBeDefined();

    registry.activateLayer('l', 1, true);
    expect(registry.getActive('z')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it PASSES on unchanged code**

Run: `npx vitest run src/engine/__tests__/layers.test.ts -t "B19"`
Expected: **PASS** — this is a characterization test pinning behaviour that must survive the optimization, not a bug reproduction. (B19 is a performance finding at `risk: medium`, so no RED step is required; the test exists so Step 4 cannot silently break it.)

- [ ] **Step 3: Apply the fix**

```ts
export class ShortcutRegistry {
  private shortcuts = new Map<string, ShortcutEntry[]>();
  private groups = new Map<string, GroupEntry[]>();
  private layers = new Map<string, { level: number; exclusive: boolean }>();
  // blockLevel() is invariant between layer mutations but is called once per
  // bucket from findActive/getActiveGroup — so a single getAllActive() over N
  // keys used to cost N full layer scans. activateLayer and deactivateLayer
  // are the only two writers of `layers`, so nulling here is exhaustive.
  private blockLevelCache: number | null = null;

  activateLayer(id: string, level: number, exclusive: boolean): void {
    this.layers.set(id, { level, exclusive });
    this.blockLevelCache = null;
  }

  deactivateLayer(id: string): void {
    this.layers.delete(id);
    this.blockLevelCache = null;
  }

  nextLevel(): number {
    let max = 0;
    for (const { level } of this.layers.values()) if (level > max) max = level;
    return max + 1;
  }

  private blockLevel(): number {
    if (this.blockLevelCache !== null) return this.blockLevelCache;
    let block = 0;
    for (const { level, exclusive } of this.layers.values()) {
      if (exclusive && level > block) block = level;
    }
    this.blockLevelCache = block;
    return block;
  }
```

The rest of the class is unchanged.

- [ ] **Step 4: Run tests to verify still GREEN**

Run: `npx vitest run src/engine/__tests__/layers.test.ts src/engine/__tests__/registry.test.ts`
Expected: PASS — both new tests and the whole existing layers suite.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Strip B19 from bughunt.md and commit**

```bash
git add src/engine/registry.ts src/engine/__tests__/layers.test.ts bughunt.md
git commit -m "perf(registry): cache blockLevel and invalidate on layer changes [B19]"
```

---

## Group 4 — engine: controller & keys

### Task 8: B14 — soft-fail register() on an invalid key string or non-function handler

**Files:**

- Modify: `src/engine/controller.ts:164-179` (`engine.register`)
- Test: `src/engine/__tests__/controller.test.ts`, `src/react/__tests__/useShortcut.test.tsx`
- Modify: `bughunt.md` (strip B14)

**Interfaces:**

- Consumes: `parseSequence(keys)` from `src/engine/keys.ts` — throws plain `Error` for empty/whitespace-only strings, unknown modifiers (e.g. `'Hyper+K'`), and dangling `+`.
- Produces: `engine.register(keys, handler, options?) => () => void` — **signature unchanged**. On invalid input it now warns and returns a no-op unregister instead of throwing. `LayerHandle.register` inherits this because it delegates to `engine.register`.

**The bug:** `useShortcut` calls `engine.register` from inside a `useEffect`. A throw from a passive effect is not recoverable by the hook and propagates to the nearest error boundary, **unmounting the consumer's subtree**. `docs/API.md` documents `useShortcut` with no mention that it can throw, and the neighbouring misuse (missing provider) deliberately soft-fails to a `console.warn` — so the failure modes are inconsistent. Separately, `register` does no `typeof handler === 'function'` check, so a non-function handler is accepted and blows up much later inside `matcher.handleKeyDown`.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/controller.test.ts`:

```ts
describe('createWhichKey.register — soft failure on misuse [B14]', () => {
  it('warns and no-ops on an unparseable key string instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    let unregister: (() => void) | undefined;
    expect(() => {
      unregister = wk.register('Hyper+K', vi.fn());
    }).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[whichkey] invalid key string "Hyper+K"'),
    );
    expect(() => unregister!()).not.toThrow();
    warn.mockRestore();
  });

  it('warns and no-ops on an empty key string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    expect(() => wk.register('   ', vi.fn())).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid key string'));
    warn.mockRestore();
  });

  it('warns and no-ops when the handler is not a function', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    // Deliberate misuse from untyped JS — the whole point of the guard.
    const notAFunction = 'nope' as unknown as ShortcutHandler;
    expect(() => wk.register('a', notAFunction)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[whichkey] handler for "a" is not a function'),
    );
    expect(wk.registry.getActive('a')).toBeUndefined();
    warn.mockRestore();
  });

  it('still registers a valid shortcut normally', () => {
    const wk = createWhichKey();
    const off = wk.register('a', vi.fn(), { description: 'Alpha' });
    expect(wk.registry.getActive('a')?.description).toBe('Alpha');
    off();
    expect(wk.registry.getActive('a')).toBeUndefined();
  });
});
```

Add to `src/react/__tests__/useShortcut.test.tsx` — the reason this finding matters:

```ts
it('does not tear down the consumer tree when the key string is invalid [B14]', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const wk = createWhichKey();
  const Child = () => { useShortcut('Hyper+K', () => {}); return <div data-testid="alive">ok</div>; };
  expect(() => render(
    <WhichKeyProvider engine={wk}><Child /></WhichKeyProvider>,
  )).not.toThrow();
  expect(screen.getByTestId('alive')).toBeInTheDocument();
  warn.mockRestore();
});
```

Read the top of `useShortcut.test.tsx` first and match how it constructs the provider — it may pass options rather than an `engine` prop. Use whatever that file already does.

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/useShortcut.test.tsx -t "B14"`
Expected: FAIL — `register('Hyper+K', …)` throws `Error: Unknown modifier "Hyper"`, and the React test throws out of the effect.

- [ ] **Step 3: Apply the fix**

In `src/engine/controller.ts`, replace `engine.register`:

```ts
    register(keys, h, opts) {
      // Soft-fail on consumer misuse, matching useShortcut's missing-provider
      // warn. register() runs inside a useEffect in the React binding, where a
      // throw is unrecoverable and unmounts the consumer's whole subtree.
      if (typeof h !== 'function') {
        console.warn(`[whichkey] handler for "${keys}" is not a function; shortcut not registered.`);
        return () => {};
      }
      let canonical: string;
      try {
        canonical = parseSequence(keys).join(' ');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[whichkey] invalid key string "${keys}": ${message}; shortcut not registered.`);
        return () => {};
      }
      const id = `wk_${idCounter++}`;
      const entry: ShortcutEntry = {
        id,
        keys: canonical,
        handler: h,
        description: opts?.description,
        enableOnInputs: opts?.enableOnInputs ?? false,
        priority: opts?.priority ?? 0,
        enabled: opts?.enabled ?? true,
        level: opts?.level ?? 0,
        global: opts?.global ?? false,
      };
      registry.register(entry);
      return () => registry.unregister(id);
    },
```

Note the `id` is now allocated **after** validation, so a rejected registration no longer burns a counter value.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/useShortcut.test.tsx`
Expected: PASS.

- [ ] **Step 5: Document the soft failure**

In `docs/API.md`, under `#### <a id="engine-register"></a>engine.register(keys, handler, options?) => () => void` (line 57), add after the existing prose:

```markdown
> **Invalid input soft-fails.** If `keys` cannot be parsed (empty string, unknown modifier, dangling `+`) or `handler` is not a function, `register` emits a `console.warn` and returns a no-op unregister function rather than throwing. This keeps `useShortcut` — which calls `register` from inside an effect — from tearing down the consumer's React tree on a typo.
```

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B14 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts src/react/__tests__/useShortcut.test.tsx docs/API.md bughunt.md
git commit -m "fix(api-surface): soft-fail register() on an invalid key string or non-function handler [B14]"
```

---

### Task 9: B22 — canonicalize the registerGroup prefix

**Files:**

- Modify: `src/engine/controller.ts:180-184` (`engine.registerGroup`)
- Test: `src/engine/__tests__/controller.test.ts`
- Modify: `bughunt.md` (strip B22)

**Interfaces:**

- Consumes: `parseSequence(prefix)` — the same canonicalizer `register` uses (after Task 8).
- Produces: `engine.registerGroup(prefix, options) => () => void` — signature unchanged. Group prefixes now live in the **same canonical namespace** as shortcut keys. Empty/unparseable prefixes soft-fail with a warn (Task 8's convention), not a throw.

**The bug (verified against the built bundle):** `register` runs `parseSequence(keys)` but `registerGroup` passes `prefix` straight through untouched, so the two key into different namespaces whenever the raw string differs from its canonical form. `registerGroup('Shift+a', {description:'Shifted group'})` + `register('Shift+a b', …)` leaves the shortcut under `'A b'` while the group sits under `'Shift+a'`; `getActiveGroup('A')` returns undefined and the popup shows a bare key with no label. Also asymmetric on empty input: `register('')` throws, `registerGroup('')` is accepted silently. `useShortcutGroup` inherits both problems via delegation.

**This extends a documented invariant.** `CLAUDE.md` states canonical key strings are the join key for registry lookups; after this task that explicitly includes group prefixes. Pin it with the test below.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/controller.test.ts`:

```ts
describe('createWhichKey.registerGroup — canonical prefix [B22]', () => {
  it('canonicalizes the prefix into the same namespace as register()', () => {
    const wk = createWhichKey();
    wk.registerGroup('Shift+a', { description: 'Shifted group' });
    wk.register('Shift+a b', vi.fn(), { description: 'Bee' });
    expect(wk.registry.getActiveGroup('A')?.description).toBe('Shifted group');
  });

  it('surfaces the group label on the popup candidate', () => {
    const wk = createWhichKey();
    wk.registerGroup('Shift+a', { description: 'Shifted group' });
    wk.register('Shift+a b', vi.fn(), { description: 'Bee' });
    expect(wk.registry.getActiveCandidates('A')[0].description).toBe('Bee');
    expect(wk.registry.getActiveGroup('A')?.description).toBe('Shifted group');
  });

  it('warns and no-ops on an empty prefix rather than accepting it silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    expect(() => wk.registerGroup('   ', { description: 'Nope' })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid group prefix'));
    warn.mockRestore();
  });

  it('is behaviour-compatible for a prefix already in canonical form', () => {
    const wk = createWhichKey();
    const off = wk.registerGroup('g', { description: 'Go to' });
    expect(wk.registry.getActiveGroup('g')?.description).toBe('Go to');
    off();
    expect(wk.registry.getActiveGroup('g')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/controller.test.ts -t "B22"`
Expected: the first three FAIL — `getActiveGroup('A')` is `undefined` because the group sits under the raw `'Shift+a'`, and the empty prefix is accepted with no warning.

- [ ] **Step 3: Apply the fix**

```ts
    registerGroup(prefix, opts) {
      // Canonicalize into the SAME namespace register() uses. Storing the raw
      // prefix meant registerGroup('Shift+a') and register('Shift+a b') keyed
      // differently ('Shift+a' vs 'A b'), so the label silently never rendered.
      let canonical: string;
      try {
        canonical = parseSequence(prefix).join(' ');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[whichkey] invalid group prefix "${prefix}": ${message}; group not registered.`);
        return () => {};
      }
      const id = `wkg_${idCounter++}`;
      registry.registerGroup({
        id,
        prefix: canonical,
        description: opts.description,
        priority: opts.priority ?? 0,
        level: opts.level ?? 0,
      });
      return () => registry.unregisterGroup(id);
    },
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/useShortcutGroup.test.tsx`
Expected: PASS. `useShortcutGroup` inherits the fix; its existing tests use canonical prefixes so they are unaffected.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Strip B22 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts bughunt.md
git commit -m "fix(api-surface): canonicalize the registerGroup prefix [B22]"
```

---

### Task 10: B23 — soft-fail an invalid helpKey instead of throwing from the factory

**Files:**

- Modify: `src/engine/controller.ts:146-158` (the `if (helpKey)` block)
- Test: `src/engine/__tests__/controller.test.ts`, `src/react/__tests__/WhichKeyProvider.test.tsx`
- Modify: `docs/API.md:45` (the `helpKey` row)
- Modify: `bughunt.md` (strip B23)

**Interfaces:**

- Consumes: `parseKey(helpKey)`.
- Produces: `createWhichKey(options?)` never throws for a bad `helpKey`. The returned engine is fully functional, just without the `?` binding.

**The bug:** `parseKey(helpKey)` runs unguarded in the factory and throws plain `Error`s for an empty string, a trailing `+`, or an unknown modifier. Worse in React: `WhichKeyProvider` calls `createWhichKey` **in its render body**, so `<WhichKeyProvider helpKey="ctrl/">` throws during render and unmounts the consumer's entire tree with no error boundary in between. Neither `docs/API.md:40-49` nor `README.md:107-113` mentions that `helpKey` can throw.

- [ ] **Step 1: Write the failing tests**

Add to `src/engine/__tests__/controller.test.ts`:

```ts
describe('createWhichKey — invalid helpKey [B23]', () => {
  it('warns and returns a working engine instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let wk: ReturnType<typeof createWhichKey> | undefined;
    expect(() => {
      wk = createWhichKey({ helpKey: 'Hyper+/' });
    }).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[whichkey] invalid helpKey "Hyper+/"'),
    );

    // The engine still works — only the help binding is gone.
    wk!.register('a', vi.fn(), { description: 'Alpha' });
    expect(wk!.registry.getActive('a')).toBeDefined();
    expect(wk!.getSnapshot().cheatsheet.visible).toBe(false);
    warn.mockRestore();
  });

  it('still binds a valid helpKey', () => {
    const wk = createWhichKey({ helpKey: 'F1' });
    expect(wk.registry.getActive('F1')).toBeDefined();
  });

  it('binds nothing when helpKey is null', () => {
    const wk = createWhichKey({ helpKey: null });
    expect(wk.registry.getAllActive()).toHaveLength(0);
  });
});
```

Add to `src/react/__tests__/WhichKeyProvider.test.tsx` — the reason this matters:

```ts
it('does not throw during render for an invalid helpKey [B23]', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(() => render(
    <WhichKeyProvider helpKey="ctrl/"><div data-testid="alive">ok</div></WhichKeyProvider>,
  )).not.toThrow();
  expect(screen.getByTestId('alive')).toBeInTheDocument();
  warn.mockRestore();
});
```

Read `WhichKeyProvider.test.tsx` first and match its existing render helpers and prop names.

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/WhichKeyProvider.test.tsx -t "B23"`
Expected: FAIL — `createWhichKey({ helpKey: 'Hyper+/' })` throws, and the provider render throws with it.

- [ ] **Step 3: Apply the fix**

```ts
if (helpKey) {
  // Soft-fail: WhichKeyProvider calls createWhichKey in its RENDER body, so
  // a throw here unmounts the consumer's entire tree with no error boundary
  // in between. Matches useShortcut's missing-provider warn convention.
  try {
    registry.register({
      id: DEFAULT_HELP_ID,
      keys: parseKey(helpKey),
      handler: () => toggleCheatsheet(),
      description: 'Toggle keyboard shortcuts',
      enableOnInputs: false,
      priority: -1,
      enabled: true,
      level: 0,
      global: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[whichkey] invalid helpKey "${helpKey}": ${message}; help shortcut disabled.`);
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/WhichKeyProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Document it**

In `docs/API.md`, in the `createWhichKey(options?)` options table (around line 45), extend the `helpKey` row's description with:

```
An unparseable value emits a `console.warn` and disables the help shortcut; it never throws.
```

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B23 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts src/react/__tests__/WhichKeyProvider.test.tsx docs/API.md bughunt.md
git commit -m "fix(api-surface): soft-fail an invalid helpKey instead of throwing from the factory [B23]"
```

> ### 🚩 Milestone after Task 10
>
> Run the full suite: `npm test`. Expected green. On red: bisect within Tasks 6–10, revert the offender, surface the diagnosis.

---

### Task 11: B30 — clamp a non-finite or negative timeoutMs to the default

**Files:**

- Modify: `src/engine/controller.ts:81` (the options destructure in `createWhichKey`)
- Test: `src/engine/__tests__/controller.test.ts`
- Modify: `docs/API.md:44` (the `timeoutMs` row)
- Modify: `bughunt.md` (strip B30)

**Interfaces:**

- Consumes: `WhichKeyOptions.timeoutMs?: number` — **signature unchanged**.
- Produces: the value handed to `new Matcher(...)` is always a finite, non-negative number.

**The bug:** `timeoutMs` is destructured with a 500 default and handed straight to the Matcher, which passes it to `setTimeout`. `setTimeout` coerces NaN, negative and overflow values to 0 — so `createWhichKey({ timeoutMs: -1 })`, or a value computed from bad config, produces a popup that flashes open on the first keystroke and a leaf-and-prefix shortcut that fires with zero grace period: the exact opposite of the documented "Milliseconds of inactivity before a partial sequence is cancelled". No error, no warning. Same path from React via `<WhichKeyProvider timeoutMs={…}>`.

**RISK: HIGH — write the RED test first and commit it separately.**

**Subtlety:** the destructuring default must still apply for `undefined` (option simply absent), and that case must **not** warn. Only an explicitly-supplied bad value warns.

- [ ] **Step 1: Write the failing characterization test**

Add to `src/engine/__tests__/controller.test.ts`:

```ts
describe('createWhichKey — timeoutMs validation [B30]', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const popupAppearsAfter = (wk: ReturnType<typeof createWhichKey>, ms: number) => {
    wk.register('g a', vi.fn());
    wk.start();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    vi.advanceTimersByTime(ms);
    const visible = wk.getSnapshot().popup.visible;
    wk.stop();
    return visible;
  };

  it.each([-1, NaN, -Infinity])('clamps %p to the 500ms default', (bad) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ timeoutMs: bad });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid timeoutMs'));
    expect(popupAppearsAfter(wk, 0)).toBe(false);
    warn.mockRestore();
  });

  it('does not warn when timeoutMs is simply absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createWhichKey();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('timeoutMs'));
    warn.mockRestore();
  });

  it('honours a valid explicit timeoutMs', () => {
    const wk = createWhichKey({ timeoutMs: 50 });
    expect(popupAppearsAfter(wk, 50)).toBe(true);
  });

  it('accepts 0 as a deliberate instant popup', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey({ timeoutMs: 0 });
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('timeoutMs'));
    expect(popupAppearsAfter(wk, 0)).toBe(true);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/controller.test.ts -t "B30"`
Expected: the `it.each` cases FAIL — no warning is emitted and `popupAppearsAfter(wk, 0)` returns `true` because `setTimeout` coerced the bad value to 0.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/engine/__tests__/controller.test.ts
git commit -m "test: characterize timeoutMs coercion before fix [B30]"
```

- [ ] **Step 4: Apply the fix**

Replace the destructure at `src/engine/controller.ts:81`:

```ts
const { helpKey = '?', sortKeys } = options;
// setTimeout silently coerces NaN / negative / overflow to 0, which turns
// "wait before showing the popup" into "fire instantly" with no diagnostic.
// Validate at the boundary; the public timeoutMs?: number stays unchanged.
const timeoutMs = ((): number => {
  const raw = options.timeoutMs;
  if (raw === undefined) return 500;
  if (Number.isFinite(raw) && raw >= 0) return raw;
  console.warn(`[whichkey] invalid timeoutMs ${String(raw)}; falling back to 500ms.`);
  return 500;
})();
```

Note `timeoutMs` is removed from the destructure so `options.timeoutMs` can be read directly and `undefined` distinguished from a supplied bad value.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts`
Expected: PASS.

- [ ] **Step 6: Document it**

In `docs/API.md`, extend the `timeoutMs` row (line 44) description with:

```
A non-finite or negative value emits a `console.warn` and falls back to `500`.
```

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 8: Strip B30 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts docs/API.md bughunt.md
git commit -m "fix(api-surface): clamp a non-finite or negative timeoutMs to the default [B30]"
```

---

### Task 12: B34 — validate an explicit pushLayer level

**Files:**

- Modify: `src/engine/controller.ts:197-215` (`engine.pushLayer`)
- Test: `src/engine/__tests__/layers.test.ts`
- Modify: `docs/API.md` (the `pushLayer` section added in Task 25 — for now just note it; Task 25 folds it in)
- Modify: `bughunt.md` (strip B34)

**Interfaces:**

- Consumes: `registry.nextLevel()`.
- Produces: `engine.pushLayer(options?: { exclusive?: boolean; level?: number }) => LayerHandle` — signature unchanged. `handle.level` is now always a non-negative finite integer.

**The bug (verified against the built bundle):** `const level = opts?.level ?? registry.nextLevel();` with no validation. `blockLevel()` floors at 0 and `isReachable` requires `entry.global || entry.level >= block`, so **any negative level is permanently unreachable**: `pushLayer({ level: -1 })` then `layer.register('z', …)` leaves `registry.getActive('z') === undefined` — the shortcut is registered, the handle looks healthy, `pop()` works, and the key just never fires.

**RISK: HIGH — write the RED test first and commit it separately.**

- [ ] **Step 1: Write the failing characterization test**

Add to `src/engine/__tests__/layers.test.ts`:

```ts
describe('pushLayer — explicit level validation [B34]', () => {
  it.each([-1, 1.5, NaN, Infinity])('warns and falls back to nextLevel() for %p', (bad) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    const layer = wk.pushLayer({ level: bad });
    layer.register('z', vi.fn(), { description: 'Zed' });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[whichkey] invalid pushLayer level'),
    );
    expect(layer.level).toBe(1);
    expect(wk.registry.getActive('z')).toBeDefined();
    layer.pop();
    warn.mockRestore();
  });

  it('honours a valid explicit level', () => {
    const wk = createWhichKey();
    const layer = wk.pushLayer({ level: 3 });
    layer.register('z', vi.fn());
    expect(layer.level).toBe(3);
    expect(wk.registry.getActive('z')).toBeDefined();
    layer.pop();
  });

  it('warns when an explicit level undercuts the next free level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    const outer = wk.pushLayer({ exclusive: true }); // level 1
    const inner = wk.pushLayer({ exclusive: true }); // level 2
    warn.mockClear();

    // nextLevel() is now 3, so level 1 undercuts by more than one.
    const undercut = wk.pushLayer({ level: 1 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] pushLayer level 1'));
    expect(undercut.level).toBe(1); // still honoured, just flagged

    undercut.pop();
    inner.pop();
    outer.pop();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/layers.test.ts -t "B34"`
Expected: the `it.each` cases FAIL — no warning, `layer.level` is the bad value, and `getActive('z')` is `undefined` for `-1`.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/engine/__tests__/layers.test.ts
git commit -m "test: characterize an unreachable pushLayer level before fix [B34]"
```

- [ ] **Step 4: Apply the fix**

```ts
    pushLayer(opts) {
      const nextLevel = registry.nextLevel();
      // A negative level is permanently unreachable: blockLevel() floors at 0
      // and isReachable requires entry.level >= block, so every shortcut on
      // the layer registers fine, the handle looks healthy, and the keys
      // silently never fire. Non-integers and non-finite values are equally
      // meaningless as level ordinals.
      const requested = opts?.level;
      let level: number;
      if (requested === undefined) {
        level = nextLevel;
      } else if (!Number.isInteger(requested) || requested < 0) {
        console.warn(
          `[whichkey] invalid pushLayer level ${String(requested)}; ` +
            `expected a non-negative integer. Falling back to ${nextLevel}.`,
        );
        level = nextLevel;
      } else {
        if (requested < nextLevel - 1) {
          console.warn(
            `[whichkey] pushLayer level ${requested} undercuts the next free level ` +
              `(${nextLevel}); shortcuts on this layer may be blocked by an active exclusive layer.`,
          );
        }
        level = requested;
      }
      const deactivate = engine.activateLayer(level, opts?.exclusive ?? false);
      const owned = new Set<() => void>();
      const track = (un: () => void): (() => void) => {
        const wrapped = () => { un(); owned.delete(wrapped); };
        owned.add(wrapped);
        return wrapped;
      };
      return {
        level,
        register: (keys, h, o) => track(engine.register(keys, h, { ...o, level })),
        registerGroup: (prefix, o) => track(engine.registerGroup(prefix, { ...o, level })),
        pop: () => {
          for (const un of [...owned]) un();
          deactivate();
        },
      };
    },
```

`Number.isInteger` rejects `NaN`, `Infinity` and `1.5` in one predicate, so no separate `Number.isFinite` check is needed.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/layers.test.ts`
Expected: PASS, including the existing layers suite (no existing test passes an explicit level, so nothing should shift).

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B34 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/layers.test.ts bughunt.md
git commit -m "fix(api-surface): validate an explicit pushLayer level [B34]"
```

---

### Task 13: B37 — keep a group label on a single-entry cheatsheet prefix

**Files:**

- Modify: `src/engine/controller.ts:65-71` (`buildCheatsheetModel`'s bucket partition)
- Test: `src/engine/__tests__/controller.test.ts`
- Modify: `bughunt.md` (strip B37)

**Interfaces:**

- Consumes: `registry.getActiveGroup(prefix)`.
- Produces: `getCheatsheetModel()` — a prefix that has a registered group label always renders as a group section, even when it holds exactly one entry whose keys equal the prefix.

**The bug (empirically confirmed):** the heuristic `entries.length === 1 && entries[0].keys === prefix` routes the bucket to `standalone`, which carries no group description. With `register('g', …)` plus `registerGroup('g', {description: 'Go to'})` the model comes back as `standalone=['g'] groups=[]` — the "Go to" label the consumer registered is never rendered anywhere in the cheatsheet, even though the popup would show it. Neighbouring cases are fine (`'g h'` alone → group; `'g' + 'g h'` → group containing both).

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/controller.test.ts`:

```ts
describe('buildCheatsheetModel — labelled single-entry prefix [B37]', () => {
  it('renders a labelled single-entry prefix as a group, not standalone', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('g', vi.fn(), { description: 'Go' });
    wk.registerGroup('g', { description: 'Go to' });

    const model = wk.getCheatsheetModel();
    expect(model.standalone).toEqual([]);
    expect(model.groups).toEqual([
      { prefix: 'g', description: 'Go to', entries: [{ keys: 'g', description: 'Go' }] },
    ]);
  });

  it('still puts an UNlabelled single-entry prefix in standalone', () => {
    const wk = createWhichKey({ helpKey: null });
    wk.register('g', vi.fn(), { description: 'Go' });

    const model = wk.getCheatsheetModel();
    expect(model.standalone).toEqual([{ keys: 'g', description: 'Go' }]);
    expect(model.groups).toEqual([]);
  });
});
```

`helpKey: null` keeps the default `?` binding out of the model so the assertions can be exact.

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/controller.test.ts -t "B37"`
Expected: the first test FAILS — `standalone` holds `g` and `groups` is empty, so the "Go to" label is nowhere.

- [ ] **Step 3: Apply the fix**

In `buildCheatsheetModel`:

```ts
for (const [prefix, entries] of buckets) {
  // A single entry whose keys ARE the prefix is a standalone shortcut —
  // unless the consumer registered a group label for that prefix, in which
  // case standalone would silently drop the label (standalone entries carry
  // no group description).
  if (entries.length === 1 && entries[0].keys === prefix && !registry.getActiveGroup(prefix)) {
    standalone.push(entries[0]);
  } else {
    groups.push({ prefix, description: registry.getActiveGroup(prefix)?.description, entries });
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/controller.test.ts src/react/__tests__/ShortcutCheatsheet.test.tsx src/vanilla/__tests__/mount.test.ts`
Expected: PASS. Both renderers read the model, so check them too.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Strip B37 from bughunt.md and commit**

```bash
git add src/engine/controller.ts src/engine/__tests__/controller.test.ts bughunt.md
git commit -m "fix(correctness): keep a group label on a single-entry cheatsheet prefix [B37]"
```

---

### Task 14: B31 — guard isMacPlatform against an absent navigator

**Files:**

- Modify: `src/engine/keys.ts:20` (`isMacPlatform`)
- Test: `src/engine/__tests__/keys.test.ts`
- Modify: `bughunt.md` (strip B31)

**Interfaces:**

- Consumes: the `navigator` global (may be absent).
- Produces: `isMacPlatform(): boolean` — never throws. Returns `false` when `navigator` is undefined, so `Mod` resolves to `Ctrl` on a headless runtime.

**The bug:** `/Mac|iPod|iPhone|iPad/.test(navigator.platform)` dereferences the `navigator` global with **no guard**, and is reached from `parseKey` for every `Mod+` binding — the form the README presents as the recommended cross-platform spelling. Node only gained a global `navigator` in v21 while `package.json` declares `engines.node >= 20`, so on a supported Node 20 SSR/prerender/test runtime `register('Mod+/')` throws `ReferenceError: navigator is not defined`. `navigator.platform` is also deprecated and frozen by anti-fingerprinting modes.

- [ ] **Step 1: Write the failing test**

Add to `src/engine/__tests__/keys.test.ts`. Read the two existing `Mod` tests first (around line 140) — they stub `navigator.platform` via `Object.defineProperty`; match that style.

```ts
describe('isMacPlatform — absent navigator [B31]', () => {
  it('resolves Mod to Ctrl instead of throwing when navigator is undefined', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    // Simulate a Node 20 SSR/prerender runtime with no navigator global.
    Reflect.deleteProperty(globalThis as object, 'navigator');
    try {
      expect(() => parseKey('Mod+/')).not.toThrow();
      expect(parseKey('Mod+/')).toBe(parseKey('Ctrl+/'));
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
    }
  });

  it('prefers userAgentData.platform when present', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgentData: { platform: 'macOS' }, platform: 'Linux x86_64' },
      configurable: true,
    });
    try {
      expect(parseKey('Mod+/')).toBe(parseKey('Cmd+/'));
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
      else Reflect.deleteProperty(globalThis as object, 'navigator');
    }
  });
});
```

Note: jsdom defines `navigator`, so deleting it is what reproduces the Node-20 condition. If `Reflect.deleteProperty` fails because jsdom's `navigator` is non-configurable in this environment, fall back to `Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true })` and adjust the guard to cover `undefined` as well as absent — `typeof navigator === 'undefined'` covers both.

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/engine/__tests__/keys.test.ts -t "B31"`
Expected: the first test FAILS with `ReferenceError: navigator is not defined`.

- [ ] **Step 3: Apply the fix**

Replace `src/engine/keys.ts:20`:

```ts
// `navigator` is absent on Node < 21 (package.json allows >= 20) and on any
// SSR/prerender runtime, and `navigator.platform` is deprecated and frozen by
// anti-fingerprinting modes. Reached from parseKey for EVERY `Mod+` binding —
// the spelling the README recommends — so it must never throw.
type PlatformSource = { userAgentData?: { platform?: string }; platform?: string };

const isMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as PlatformSource;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /Mac|iPod|iPhone|iPad/.test(platform);
};
```

`navigator.userAgentData` is not in the default TS DOM lib, which is why the access goes through the narrow local `PlatformSource` type rather than `any` (the repo forbids unjustified `any`).

Note `'macOS'` — the value `userAgentData.platform` reports on a Mac — matches `/Mac/`, so the existing regex needs no change.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/engine/__tests__/keys.test.ts`
Expected: PASS, including both pre-existing `Mod` tests that stub `navigator.platform` (they set no `userAgentData`, so the `??` falls through to `platform`).

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Strip B31 from bughunt.md and commit**

```bash
git add src/engine/keys.ts src/engine/__tests__/keys.test.ts bughunt.md
git commit -m "fix(correctness): guard isMacPlatform against an absent navigator [B31]"
```

---

## Group 5 — react

### Task 15: B24 — warn once when a renderer is mounted outside WhichKeyProvider

**Files:**

- Modify: `src/react/context.ts` (add `warnNoProvider`)
- Modify: `src/react/useWhichKeyState.ts:12-25`
- Modify: `src/react/ShortcutCheatsheet.tsx:12-53`
- Modify: `src/react/useShortcut.ts:17-21`
- Modify: `src/react/useShortcutGroup.ts:10-14`
- Modify: `src/react/WhichKeyLayer.tsx:13-19`
- Test: `src/react/__tests__/useWhichKeyState.test.tsx`, `src/react/__tests__/WhichKeyPopup.test.tsx`, `src/react/__tests__/ShortcutCheatsheet.test.tsx`
- Modify: `bughunt.md` (strip B24)

**Interfaces:**

- Produces: `warnNoProvider(what: string): void` exported from `src/react/context.ts` — **internal**, do NOT add it to `src/react/index.ts`. Dedupes per `what` via a module-level `Set<string>`, so a component that re-renders warns once per distinct message for the lifetime of the module.
- Also produces: `resetNoProviderWarnings(): void` from the same module, exported for test isolation only. Also NOT in `index.ts`.
- **Public signature change:** `useWhichKeyState()` gains an optional `what?: string` parameter so `<WhichKeyPopup>` can name itself in the diagnostic. This is additive and non-breaking, but `useWhichKeyState` is a public export (`src/react/index.ts:8`), so per CLAUDE.md the parameter **must be documented in `docs/API.md`** — Step 8 does that. The alternative (a separate internal warn hook in `WhichKeyPopup`) was rejected because it emits two warnings for one mistake, since the hook and the component dedupe under different keys.

**The bug:** `useShortcut`, `useShortcutGroup` and `<WhichKeyLayer>` all emit a consistent `[whichkey] … outside <WhichKeyProvider>` warn. The three consumers that actually put pixels on screen do **not**: `useWhichKeyState` falls back to `noopSubscribe`/`getEmptySnapshot` and returns a no-op `cancel` in silence, `<ShortcutCheatsheet>` falls back and returns null, and `<WhichKeyPopup>` inherits the silence via `useWhichKeyState`. This is the highest-frequency integration mistake — placing `<WhichKeyPopup />` outside the provider — and it presents as "the popup never appears" **with the shortcuts still firing**, so the developer suspects CSS, z-index or the stylesheet import, not the provider. The existing three warns are also ungated and undeduped, re-firing on every effect dep change.

**RISK: HIGH — write the RED test first and commit it separately.**

**Two hard constraints:**

1. **SSR safety.** `useWhichKeyState` supplies a `getServerSnapshot` and both React components must render nothing on the server. The warn must therefore fire from a `useEffect` — never during render, never on the server. `src/react/__tests__/ssr.test.tsx` will catch a violation; run it.
2. **Test isolation.** Module-level dedupe state leaks across tests in a file. Export `resetNoProviderWarnings()` and call it in a `beforeEach` in every test that asserts on these warnings.

- [ ] **Step 1: Write the failing characterization test**

Add to `src/react/__tests__/WhichKeyPopup.test.tsx` (read its imports and render helpers first):

```ts
describe('WhichKeyPopup outside a provider [B24]', () => {
  beforeEach(() => resetNoProviderWarnings());

  it('warns naming the component instead of failing silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<WhichKeyPopup />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<WhichKeyPopup>'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<WhichKeyProvider>'));
    warn.mockRestore();
  });

  it('warns once per mount, not once per render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<WhichKeyPopup />);
    rerender(<WhichKeyPopup layout="horizontal" />);
    rerender(<WhichKeyPopup maxRows={3} />);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
```

Add to `src/react/__tests__/ShortcutCheatsheet.test.tsx`:

```ts
it('warns when mounted outside a provider [B24]', () => {
  resetNoProviderWarnings();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<ShortcutCheatsheet />);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('<ShortcutCheatsheet>'));
  warn.mockRestore();
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/react/__tests__/WhichKeyPopup.test.tsx src/react/__tests__/ShortcutCheatsheet.test.tsx -t "B24"`
Expected: FAIL — first on the missing `resetNoProviderWarnings` import, then because no warning is emitted at all.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/react/__tests__/WhichKeyPopup.test.tsx src/react/__tests__/ShortcutCheatsheet.test.tsx
git commit -m "test: characterize silent renderer fallback outside the provider before fix [B24]"
```

- [ ] **Step 4: Add the shared helper**

Append to `src/react/context.ts`:

```ts
// One deduped diagnostic for every "used outside <WhichKeyProvider>" path.
// Without this the three hooks warned and the three RENDERERS stayed silent —
// so the most common integration mistake (placing <WhichKeyPopup /> outside
// the provider) presented as "the popup never appears" while shortcuts kept
// firing, sending developers hunting through CSS and z-index instead.
// Deduped because the callers fire from effects that re-run on dep changes.
const warned = new Set<string>();

export const warnNoProvider = (what: string): void => {
  const message =
    `[whichkey] ${what} used outside <WhichKeyProvider>; ` +
    `wrap your app in <WhichKeyProvider> for it to work.`;
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
};

/** Test-only: clears the dedupe set so each test observes a fresh warning. */
export const resetNoProviderWarnings = (): void => warned.clear();
```

Do **not** add either export to `src/react/index.ts` — they are internal.

- [ ] **Step 5: Route all five call sites through it**

`src/react/useWhichKeyState.ts` — add an effect that fires only when there is no engine:

```ts
import { useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { WhichKeyContext, warnNoProvider } from './context';
import type { WhichKeyState, WhichKeySnapshot } from '../engine';

const EMPTY: WhichKeySnapshot = {
  popup: { visible: false, currentSequence: [], candidates: [] },
  cheatsheet: { visible: false },
};
const noopSubscribe = () => () => {};
const getEmptySnapshot = () => EMPTY;

export const useWhichKeyState = (what = 'useWhichKeyState()'): WhichKeyState => {
  const engine = useContext(WhichKeyContext);
  // From an effect, not render: this hook backs SSR-safe components that must
  // produce no output (and no console noise) on the server.
  useEffect(() => {
    if (!engine) warnNoProvider(what);
  }, [engine, what]);
  const snapshot = useSyncExternalStore(
    engine ? engine.subscribe : noopSubscribe,
    engine ? engine.getSnapshot : getEmptySnapshot,
    getEmptySnapshot,
  );
  return useMemo<WhichKeyState>(
    () => ({
      visible: snapshot.popup.visible,
      currentSequence: snapshot.popup.currentSequence,
      candidates: snapshot.popup.candidates,
      cancel: engine ? engine.cancel : () => {},
    }),
    [snapshot, engine],
  );
};
```

The optional `what` parameter defaults to the hook's own name and lets `<WhichKeyPopup>` name itself. It is additive — existing callers keep compiling.

`src/react/WhichKeyPopup.tsx` — pass the component name through:

```ts
const state = useWhichKeyState('<WhichKeyPopup>');
```

`src/react/ShortcutCheatsheet.tsx` — add an effect alongside the existing one. Insert **before** the existing focus-trap `useEffect` (hooks must run unconditionally, and the component early-returns `null` after them):

```ts
useEffect(() => {
  if (!engine) warnNoProvider('<ShortcutCheatsheet>');
}, [engine]);
```

and add `warnNoProvider` to the existing `./context` import.

`src/react/useShortcut.ts` — replace the inline warn:

```ts
useEffect(() => {
  if (!engine) {
    warnNoProvider('useShortcut()');
    return;
  }
  return engine.register(keys, (event) => handlerRef.current(event), {
    description,
    enableOnInputs,
    priority,
    enabled,
    global,
    level,
  });
}, [engine, keys, description, enableOnInputs, priority, enabled, global, level]);
```

and import `warnNoProvider` from `./context`.

`src/react/useShortcutGroup.ts` — same shape, `warnNoProvider('useShortcutGroup()')`.

`src/react/WhichKeyLayer.tsx` — same shape, `warnNoProvider('<WhichKeyLayer>')`.

- [ ] **Step 6: Fix the three existing warn assertions**

`useShortcut.test.tsx`, `useShortcutGroup.test.tsx` and `WhichKeyLayer.test.tsx` assert on the old message text. The new unified message is `[whichkey] useShortcut() used outside <WhichKeyProvider>; wrap your app in <WhichKeyProvider> for it to work.` Update those assertions to match, and add `beforeEach(() => resetNoProviderWarnings())` to each describe that asserts on a warning — otherwise the second test in a file sees a deduped no-op.

This is a message-text change, not a test refactor: the assertion pins the exact string being deliberately rewritten.

- [ ] **Step 7: Run tests to verify GREEN**

Run: `npx vitest run src/react/`
Expected: PASS across all nine React test files — including `ssr.test.tsx`, which proves the warn does not fire during server render.

- [ ] **Step 8: Document the new optional parameter**

`useWhichKeyState` is a public export, so its new optional parameter has to appear in the reference. In `docs/API.md` under `### useWhichKeyState()` (line 248), change the heading to `### useWhichKeyState(what?)` , update the matching TOC entry, and add:

```markdown
| Parameter | Type     | Default                | Description                                                                                                                                                   |
| --------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `what`    | `string` | `'useWhichKeyState()'` | Label used in the "used outside `<WhichKeyProvider>`" console warning. Set by `<WhichKeyPopup>` so the warning names the component; consumers rarely need it. |
```

- [ ] **Step 9: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
`react-hooks/exhaustive-deps` (added in Task 1) now checks these effects — expect it to be satisfied by the dep arrays above.

- [ ] **Step 10: Strip B24 from bughunt.md and commit**

```bash
git add src/react docs/API.md bughunt.md
git commit -m "fix(observability): warn once when a renderer is mounted outside WhichKeyProvider [B24]"
```

> ### 🚩 Milestone after Task 15
>
> Run the full suite: `npm test`. Expected green. On red: bisect within Tasks 11–15, revert the offender, surface the diagnosis.

---

### Task 16: B29 — make clamp01 and clampRows total over NaN and share one copy

**Files:**

- Create: `src/shared/clamp.ts`
- Modify: `src/react/WhichKeyPopup.tsx:12-13` (delete the local copies, import instead)
- Modify: `src/vanilla/popup.ts:5-6` (same)
- Test: `src/react/__tests__/WhichKeyPopup.test.tsx`, `src/vanilla/__tests__/mount.test.ts`
- Modify: `bughunt.md` (strip B29)

**Interfaces:**

- Produces: `src/shared/clamp.ts` exporting
  - `DEFAULT_BACKGROUND_OPACITY = 0.95`
  - `DEFAULT_MAX_ROWS = 5`
  - `clamp01(n: number): number` — `Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_BACKGROUND_OPACITY`
  - `clampRows(n: number): number` — `Number.isFinite(n) ? Math.max(1, Math.floor(n)) : DEFAULT_MAX_ROWS`
- **Internal module.** Do NOT export it from any `index.ts`. It is a renderer helper, and adding it to a public entry point would commit the project to supporting it.

**The bug:** `Math.max(0, NaN) === NaN`, so both helpers are identity for NaN — and the pair is duplicated verbatim in both renderers, so both share the hole. A consumer computing the value from config or user input (`backgroundOpacity={Number(cfg.opacity)}`) gets `rgba(17, 24, 39, NaN)`, which the CSSOM rejects — so `backgroundColor` is never set and the popup renders **with no background at all**, leaving `#f3f4f6` text on the bare host page: invisible on any light background. `maxRows={NaN}` similarly yields `repeat(NaN, auto)` and the horizontal grid collapses. These helpers exist purely to be defensive and are not.

**Placement rationale:** `src/engine/` must stay framework-free and these are renderer-only, so a new `src/shared/` is the right home. Confirm after the change that tsup still builds all three entry points and that this creates no `react` → `vanilla` dependency (both import from `shared`, neither from the other).

- [ ] **Step 1: Write the failing tests**

Add to `src/react/__tests__/WhichKeyPopup.test.tsx`:

```ts
describe('WhichKeyPopup — non-finite props [B29]', () => {
  it('falls back to the default opacity instead of emitting rgba(..., NaN)', () => {
    // render with a visible popup — reuse this file's existing helper for that
    const { popup } = renderVisiblePopup({ backgroundOpacity: NaN });
    expect(popup.style.backgroundColor).not.toBe('');
    expect(popup.getAttribute('style')).not.toContain('NaN');
  });

  it('falls back to the default row count instead of repeat(NaN, auto)', () => {
    const { grid } = renderVisiblePopup({ layout: 'horizontal', maxRows: NaN });
    expect(grid.style.gridTemplateRows).toBe('repeat(5, auto)');
  });
});
```

Read `WhichKeyPopup.test.tsx` first — it already has a helper that renders a visible popup (the file covers 0, 1, 0.5, 0.7 opacity and negative/overflow rows). Reuse that helper's real name rather than inventing `renderVisiblePopup`.

Add the mirror to `src/vanilla/__tests__/mount.test.ts`:

```ts
it('vanilla popup falls back to defaults for non-finite options [B29]', () => {
  const wk = createWhichKey({ sortKeys: 'alphabetical' });
  wk.register('g a', vi.fn(), { description: 'Alpha' });
  const ui = mountWhichKey(wk, {
    popup: { layout: 'horizontal', maxRows: NaN, backgroundOpacity: NaN },
  });
  wk.start();
  press('g');
  vi.advanceTimersByTime(500);

  const popup = document.querySelector('.wk-popup') as HTMLElement;
  expect(popup.getAttribute('style')).not.toContain('NaN');
  const grid = document.querySelector('.wk-popup__grid') as HTMLElement;
  expect(grid.style.gridTemplateRows).toBe('repeat(5, auto)');

  ui.unmount();
  wk.stop();
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts -t "B29"`
Expected: FAIL — the style string contains `NaN` and `gridTemplateRows` is `repeat(NaN, auto)`.

- [ ] **Step 3: Create the shared module**

`src/shared/clamp.ts`:

```ts
// Shared by both renderers. Previously duplicated verbatim in
// src/react/WhichKeyPopup.tsx and src/vanilla/popup.ts, and both copies were
// identity for NaN (Math.max(0, NaN) === NaN) — which emitted
// `rgba(17, 24, 39, NaN)`, a declaration the CSSOM rejects outright, so the
// popup rendered with NO background and light text on the bare host page.
export const DEFAULT_BACKGROUND_OPACITY = 0.95;
export const DEFAULT_MAX_ROWS = 5;

export const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_BACKGROUND_OPACITY;

export const clampRows = (n: number): number =>
  Number.isFinite(n) ? Math.max(1, Math.floor(n)) : DEFAULT_MAX_ROWS;
```

- [ ] **Step 4: Point both renderers at it**

`src/react/WhichKeyPopup.tsx` — delete lines 12-13 and import:

```ts
import { clamp01, clampRows, DEFAULT_BACKGROUND_OPACITY, DEFAULT_MAX_ROWS } from '../shared/clamp';
```

Use the constants for the prop defaults so the fallback and the default are one value:

```ts
export const WhichKeyPopup = ({
  layout = 'vertical',
  maxRows = DEFAULT_MAX_ROWS,
  backgroundOpacity = DEFAULT_BACKGROUND_OPACITY,
}: WhichKeyPopupProps = {}) => {
```

`src/vanilla/popup.ts` — delete lines 5-6 and import:

```ts
import { clamp01, clampRows } from '../shared/clamp';
```

`src/vanilla/mount.ts` — the `popupOpts` defaults at lines 19-21 duplicate the same two magic numbers. Import the constants and use them:

```ts
import { DEFAULT_BACKGROUND_OPACITY, DEFAULT_MAX_ROWS } from '../shared/clamp';
// ...
const popupOpts: PopupOptions | null =
  opts.popup === false
    ? null
    : {
        layout: opts.popup?.layout ?? 'vertical',
        maxRows: opts.popup?.maxRows ?? DEFAULT_MAX_ROWS,
        backgroundOpacity: opts.popup?.backgroundOpacity ?? DEFAULT_BACKGROUND_OPACITY,
      };
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts`
Expected: PASS, including the existing 0 / 1 / 0.5 / 0.7 and negative/overflow-rows coverage — `0` is finite so `clamp01(0)` is still `0`, not the default.

- [ ] **Step 6: Verify the build still emits three clean entry points**

Run: `npm run build`
Expected: success. Then confirm the shared module was inlined into each bundle rather than emitted as a stray public entry:

```bash
ls dist/
grep -rl 'DEFAULT_BACKGROUND_OPACITY' dist/*.d.ts dist/*/index.d.ts 2>/dev/null || echo "not in public types — correct"
```

Expected: `src/shared/clamp.ts` does not appear as its own entry point and its names are not in any public `.d.ts` export list.

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 8: Strip B29 from bughunt.md and commit**

```bash
git add src/shared src/react/WhichKeyPopup.tsx src/vanilla/popup.ts src/vanilla/mount.ts src/react/__tests__/WhichKeyPopup.test.tsx src/vanilla/__tests__/mount.test.ts bughunt.md
git commit -m "fix(api-surface): make clamp01 and clampRows total over NaN and share one copy [B29]"
```

---

## Group 6 — vanilla + styles

### Task 17: B18 — keep a stable vanilla popup host instead of rebuilding it per emit

**Files:**

- Modify: `src/vanilla/mount.ts:24-70` (`render`, and `unmount`)
- Test: `src/vanilla/__tests__/mount.test.ts`
- Modify: `bughunt.md` (strip B18)

**Interfaces:**

- Consumes: `renderPopup(prefix, snapshot, opts): HTMLElement | null` from `./popup` — unchanged.
- Produces: the popup lives inside a stable host element appended once at mount, **before** any cheatsheet backdrop. The rendered popup node keeps its existing `data-testid="whichkey-popup"`, `data-layout`, `role="status"`, `aria-live`, `aria-atomic` and `aria-label` contract exactly.

**The bug:** `render()` unconditionally does `popupNode?.remove(); popupNode = null;` then re-`appendChild`s a freshly built node on every engine emit, while the cheatsheet backdrop is appended once on open and left in place. Since `.wk-popup` and `.wk-backdrop` share `z-index: 50`, painting order falls to **DOM order** — so once the cheatsheet is open, the next popup render lands _after_ the backdrop and the popup paints on top of the full-screen overlay. React reconciles in place and honours the JSX order, so there the backdrop correctly covers the popup: a renderer divergence. While the popup is open, each continuation keypress also discards the entire panel and allocates a fresh subtree (full detach/reattach, style recalc, visible flicker).

**RISK: HIGH — write the RED test first and commit it separately.**

**Constraints:**

- The host must use `${prefix}-`, never a hardcoded `wk-` — `classPrefix` threads through every vanilla class write.
- `unmount()` must remove the host.
- The host is a **wrapper**, so give it no `wk-popup` class of its own (that class carries `position: fixed` and the panel styling). Use a neutral `${prefix}-popup-host` and leave the styling on the inner node. Since the host is a positioning-neutral empty wrapper around a `position: fixed` child, it needs no CSS rule — but **note it for Task 19**, whose mechanical class-contract test will otherwise flag it. Task 19's test should scan only classes on _rendered content_ elements, or the host class gets an explicit rule.

- [ ] **Step 1: Write the failing characterization test**

Add to `src/vanilla/__tests__/mount.test.ts`:

```ts
describe('mountWhichKey — stable popup host [B18]', () => {
  it('keeps the popup below the cheatsheet backdrop in DOM order', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.registerGroup('g', { description: 'Go' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk);
    wk.start();

    press('?'); // open the cheatsheet
    press('g'); // then start a sequence
    vi.advanceTimersByTime(500);

    const popup = document.querySelector('.wk-popup')!;
    const backdrop = document.querySelector('.wk-backdrop')!;
    expect(popup).not.toBeNull();
    expect(backdrop).not.toBeNull();
    // DOCUMENT_POSITION_FOLLOWING === 4: backdrop comes AFTER the popup,
    // so with equal z-index the backdrop paints on top, matching React.
    expect(popup.compareDocumentPosition(backdrop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    ui.unmount();
    wk.stop();
  });

  it('reuses one host element across renders instead of reallocating', () => {
    const wk = createWhichKey({ sortKeys: 'alphabetical' });
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    wk.register('g b', vi.fn(), { description: 'Bravo' });
    const ui = mountWhichKey(wk);
    wk.start();

    press('g');
    vi.advanceTimersByTime(500);
    const hostFirst = document.querySelector('.wk-popup')!.parentElement;

    wk.cancel();
    press('g');
    vi.advanceTimersByTime(500);
    const hostSecond = document.querySelector('.wk-popup')!.parentElement;

    expect(hostSecond).toBe(hostFirst);

    ui.unmount();
    wk.stop();
  });

  it('unmount removes the host from the container', () => {
    const wk = createWhichKey();
    const ui = mountWhichKey(wk);
    wk.start();
    ui.unmount();
    expect(document.querySelector('.wk-popup-host')).toBeNull();
    wk.stop();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/vanilla/__tests__/mount.test.ts -t "B18"`
Expected: the first test FAILS (the popup is appended after the backdrop, so the position bit is 0) and the second FAILS (the parent is the container, identical across renders only by accident — read the actual failure; if it passes for that reason, tighten it to assert `document.querySelector('.wk-popup-host')` exists and is stable).

- [ ] **Step 3: Commit the RED test**

```bash
git add src/vanilla/__tests__/mount.test.ts
git commit -m "test: characterize vanilla popup stacking and churn before fix [B18]"
```

- [ ] **Step 4: Apply the fix**

In `src/vanilla/mount.ts`, replace the `popupNode` state and the popup half of `render` with a stable host created and appended at mount time:

```ts
// A stable host appended ONCE, before any cheatsheet backdrop. The previous
// code removed and re-appended the popup on every emit, so once the
// cheatsheet was open the popup landed AFTER the backdrop in DOM order —
// and since both share a z-index, DOM order decides painting, so the popup
// drew on top of the full-screen overlay. React reconciles in place and
// does not have this bug; this keeps the two renderers in agreement. It
// also stops a full detach/reattach + style recalc on every keystroke.
const popupHost = document.createElement('div');
popupHost.className = `${prefix}-popup-host`;
popupHost.hidden = true;
if (popupOpts) container.appendChild(popupHost);

let cheatsheetNode: HTMLElement | null = null;
let cheatsheetDestroy: (() => void) | null = null;

const onEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape') engine.closeCheatsheet();
};

const render = () => {
  const snap = engine.getSnapshot();
  // Popup — replace children in place; never move the host.
  if (popupOpts) {
    const node = renderPopup(prefix, snap, popupOpts);
    if (node) {
      popupHost.replaceChildren(node);
      popupHost.hidden = false;
    } else {
      popupHost.replaceChildren();
      popupHost.hidden = true;
    }
  }
  // Cheatsheet — unchanged from here down.
  if (showCheatsheet) {
    if (snap.cheatsheet.visible && !cheatsheetNode) {
      const sheet = renderCheatsheet(prefix, engine.getCheatsheetModel(), () =>
        engine.closeCheatsheet(),
      );
      cheatsheetNode = sheet.element;
      cheatsheetDestroy = sheet.destroy;
      container.appendChild(cheatsheetNode);
      (cheatsheetNode.querySelector(`.${prefix}-cheatsheet`) as HTMLElement | null)?.focus();
      document.addEventListener('keydown', onEscape);
    } else if (!snap.cheatsheet.visible && cheatsheetNode) {
      cheatsheetNode.remove();
      cheatsheetNode = null;
      cheatsheetDestroy?.();
      cheatsheetDestroy = null;
      document.removeEventListener('keydown', onEscape);
    }
  }
};
```

and in `unmount()` replace `popupNode?.remove();` with `popupHost.remove();`.

`popupHost.hidden = true` uses the HTML `hidden` attribute, which resolves to `display: none` via the UA stylesheet — no new CSS rule needed. Because the host is only appended when `popupOpts` is non-null, `popup: false` still appends nothing.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/vanilla/__tests__/mount.test.ts`
Expected: PASS, including the existing `classPrefix`, cheatsheet-toggle and unmount tests. If an existing test queried `container.lastElementChild` for the popup, update the query — that is a query fix, not a behaviour change.

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B18 from bughunt.md and commit**

```bash
git add src/vanilla/mount.ts src/vanilla/__tests__/mount.test.ts bughunt.md
git commit -m "fix(frontend): keep a stable vanilla popup host instead of rebuilding it per emit [B18]"
```

---

### Task 18: B26 — expose the overlay z-index as a CSS custom property

**Files:**

- Modify: `src/styles.css:16` (`.wk-popup`) and `:40` (`.wk-backdrop`)
- Create: `src/__tests__/styles-contract.test.ts`
- Modify: `README.md` (Styling section, around line 216)
- Modify: `bughunt.md` (strip B26)

**Interfaces:**

- Produces: two documented CSS custom properties — `--wk-z-index` (default `1000`) and `--wk-z-index-backdrop` (defaults to `--wk-z-index`). Consumers set them on `:root` or any ancestor.

**The bug:** `.wk-popup` and `.wk-backdrop` both use a literal `z-index: 50`. This library renders _over_ someone else's app, but 50 is below the stacking layer every major UI kit uses for modals (Bootstrap `.modal` 1055, MUI modal 1300, Ant Design 1000). A consumer who presses `?` while any such dialog is open gets the cheatsheet rendered behind it and unreachable. Because both which-key layers use the identical value, DOM order alone decides popup-vs-backdrop ordering — which is what made B18 observable. There is no custom property, so overriding requires out-specifying two selectors from the shipped sheet.

**RISK: HIGH — write the RED test first and commit it separately.**

**On testing CSS:** there is no CSS-rendering test infrastructure in this repo, and jsdom does not do cascade or stacking. The honest guard is a **text assertion over the shipped stylesheet**, following the existing `src/engine/__tests__/package-exports.test.ts` precedent of asserting over file contents. Task 19 extends the same file.

- [ ] **Step 1: Write the failing contract test**

Create `src/__tests__/styles-contract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../');
const css = readFileSync(join(root, 'src/styles.css'), 'utf8');

/** Body of the first rule whose selector list exactly matches `selector`. */
const ruleBody = (selector: string): string => {
  const match = css.match(
    new RegExp(
      `(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`,
      'm',
    ),
  );
  if (!match) throw new Error(`No rule found for selector ${selector}`);
  return match[2];
};

describe('styles.css — overlay stacking contract [B26]', () => {
  it('resolves the popup z-index through --wk-z-index', () => {
    expect(ruleBody('.wk-popup')).toMatch(/z-index:\s*var\(--wk-z-index,\s*1000\)/);
  });

  it('resolves the backdrop z-index through --wk-z-index-backdrop falling back to --wk-z-index', () => {
    expect(ruleBody('.wk-backdrop')).toMatch(
      /z-index:\s*var\(--wk-z-index-backdrop,\s*var\(--wk-z-index,\s*1000\)\)/,
    );
  });

  it('has no hardcoded z-index left anywhere in the sheet', () => {
    const hardcoded = css.match(/z-index:\s*(?!var\()[^;]+;/g) ?? [];
    expect(hardcoded).toEqual([]);
  });

  it('documents both custom properties in the README', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('--wk-z-index');
    expect(readme).toContain('--wk-z-index-backdrop');
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/__tests__/styles-contract.test.ts`
Expected: FAIL — the sheet has `z-index: 50` literals and the README mentions neither variable.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/__tests__/styles-contract.test.ts
git commit -m "test: characterize the hardcoded overlay z-index before fix [B26]"
```

- [ ] **Step 4: Apply the fix**

In `src/styles.css`, change `.wk-popup`'s `z-index: 50;` to:

```css
z-index: var(--wk-z-index, 1000);
```

and `.wk-backdrop`'s line to:

```css
position: fixed;
inset: 0;
z-index: var(--wk-z-index-backdrop, var(--wk-z-index, 1000));
```

Add a short comment above `.wk-popup` explaining the default:

```css
/* 1000 clears Ant Design (1000) and sits under Bootstrap's .modal (1055) and
   MUI's modal (1300); override --wk-z-index to place which-key relative to
   your own modal layer. */
```

- [ ] **Step 5: Document the variables in the README**

In the Styling section of `README.md` (around line 216), after the class table, add:

````markdown
### Stacking order

The overlay's `z-index` is exposed as a CSS custom property so you can place which-key relative to your own modal layer without out-specifying the shipped selectors:

| Property                | Default             | Applies to                                        |
| ----------------------- | ------------------- | ------------------------------------------------- |
| `--wk-z-index`          | `1000`              | `.wk-popup`, and `.wk-backdrop` unless overridden |
| `--wk-z-index-backdrop` | `var(--wk-z-index)` | `.wk-backdrop` only                               |

```css
:root {
  --wk-z-index: 1400; /* above MUI's modal layer (1300) */
}
```
````

The default of `1000` clears Ant Design's modal layer but sits below Bootstrap's `.modal` (1055) and MUI's modal (1300) — raise it if you need the cheatsheet over one of those.

````

- [ ] **Step 6: Run tests to verify GREEN**

Run: `npx vitest run src/__tests__/styles-contract.test.ts`
Expected: PASS, all four.

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Confirm `dist/styles.css` was copied with the change: `grep -n 'wk-z-index' dist/styles.css`

- [ ] **Step 8: Strip B26 from bughunt.md and commit**

```bash
git add src/styles.css src/__tests__/styles-contract.test.ts README.md bughunt.md
git commit -m "fix(frontend): expose the overlay z-index as a CSS custom property [B26]"
````

---

### Task 19: B40 — define the missing wk-cheatsheet\_\_section rule

**Files:**

- Modify: `src/styles.css` (add `.wk-cheatsheet__section` next to `.wk-cheatsheet__sections` at line 51)
- Modify: `src/__tests__/styles-contract.test.ts` (extend with the mechanical emitted-vs-defined check)
- Modify: `bughunt.md` (strip B40)

**Interfaces:**

- Consumes: the class literals emitted by `src/react/**` and `src/vanilla/**`.
- Produces: a stylesheet where every emitted `wk-*` content class has a rule — and a test that keeps it that way.

**The bug:** both `ShortcutCheatsheet.tsx:75` and `vanilla/cheatsheet.ts:65` emit `wk-cheatsheet__section` on the per-group `<section>`, but `src/styles.css` has no `.wk-cheatsheet__section` selector — it defines the _plural_ `.wk-cheatsheet__sections` container at line 51 and every other cheatsheet child. It is the only class either renderer emits that the shipped theme does not define, so the theme is contractually incomplete: a consumer inspecting the DOM finds a hook the default theme silently ignores. Visually benign today because the flex-column parent supplies the spacing.

**Already done, verify don't duplicate:** `wk-cheatsheet__section` is **already listed** in both class tables (`README.md` Styling and `docs/API.md` "CSS class contract"). Check before editing — the finding's proposed doc change is already satisfied. Only the CSS rule and the guard test are missing.

- [ ] **Step 1: Extend the contract test with the mechanical check**

Append to `src/__tests__/styles-contract.test.ts`:

```ts
import { readdirSync } from 'node:fs';

/** Every wk-* class literal either renderer writes onto a rendered element. */
const emittedClasses = (): Set<string> => {
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        if (dirent.name !== '__tests__') walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(dirent.name)) continue;
      const src = readFileSync(full, 'utf8');
      // React: className="wk-foo wk-bar" / 'wk-foo'
      // Vanilla: `${p}-foo` templates — normalized to wk- for comparison.
      for (const m of src.matchAll(/\bwk-[a-z0-9_-]+/g)) found.add(m[0]);
      for (const m of src.matchAll(/\$\{p\}-([a-z0-9_-]+)/g)) found.add(`wk-${m[1]}`);
      for (const m of src.matchAll(/\$\{prefix\}-([a-z0-9_-]+)/g)) found.add(`wk-${m[1]}`);
    }
  };
  walk(join(root, 'src/react'));
  walk(join(root, 'src/vanilla'));
  return found;
};

describe('styles.css — every emitted class has a rule [B40]', () => {
  // Structural wrappers that deliberately carry no styling.
  const EXEMPT = new Set([
    'wk-popup-host', // positioning-neutral wrapper added in B18; the
    // styled node is its `.wk-popup` child.
    'wk-cheatsheet-title', // an id, not a class (aria-labelledby target).
  ]);

  it('defines a rule for every wk-* class the renderers emit', () => {
    const missing = [...emittedClasses()]
      .filter((cls) => !EXEMPT.has(cls))
      .filter((cls) => !new RegExp(`\\.${cls}\\b`).test(css))
      .sort();
    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/__tests__/styles-contract.test.ts -t "B40"`
Expected: FAIL with `missing` containing `wk-cheatsheet__section`. If it also lists other classes, investigate each — either it is a genuine gap worth fixing in this task, or the extraction regex over-matched (e.g. it picked up a string in a comment) and the regex or `EXEMPT` set needs tightening. Do not blanket-exempt a real gap.

- [ ] **Step 3: Apply the fix**

In `src/styles.css`, immediately after the `.wk-cheatsheet__sections` rule (line 51), add:

```css
.wk-cheatsheet__section {
  display: block;
  break-inside: avoid;
}
```

`break-inside: avoid` keeps a group's heading and its list together if a consumer ever prints the sheet or lays it out in columns — a deliberate rule rather than a placeholder, which is what makes the class a real hook.

- [ ] **Step 4: Verify the class tables already list it**

```bash
grep -n 'wk-cheatsheet__section\b' README.md docs/API.md
```

Expected: one hit in each (the singular row already exists in both tables). If either is missing, add the row:

```
| `wk-cheatsheet__section`      | One group's section                              |
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/__tests__/styles-contract.test.ts`
Expected: PASS — both the B26 tests and the new mechanical check.

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B40 from bughunt.md and commit**

```bash
git add src/styles.css src/__tests__/styles-contract.test.ts README.md docs/API.md bughunt.md
git commit -m "fix(frontend): define the missing wk-cheatsheet__section rule [B40]"
```

---

### Task 20: B32 — warn and no-op on a duplicate mountWhichKey for one container

**Files:**

- Modify: `src/vanilla/mount.ts` (module scope + `mountWhichKey` head + `unmount`)
- Test: `src/vanilla/__tests__/mount.test.ts`
- Modify: `docs/API.md` (the `mountWhichKey` section, around line 293)
- Modify: `bughunt.md` (strip B32)

**Interfaces:**

- Produces: `mountWhichKey(engine, options?)` — **return type unchanged**. A second mount on a container that already has a live mount warns and returns a **no-op handle** (`{ unmount() {} }`), leaving the first mount untouched. `unmount()` is idempotent and clears the container's entry.

**The bug:** nothing tracks whether a container already has a renderer attached. Calling `mountWhichKey(wk)` twice — a hot-reload re-run, a component that mounts on route change without unmounting, two modules wiring the same engine — yields two subscriptions and two nodes appended to `document.body`, both carrying `data-testid="whichkey-popup"` and `role="dialog" aria-label="Keyboard shortcuts"`. Two same-labelled dialogs is an a11y defect, the escape listener is registered twice, and the first `unmount()` leaves the second renderer live.

**RISK: HIGH — write the RED test first and commit it separately.**

**Design decision (make it explicitly, record it in the commit body):** the second call returns a **no-op handle**, not a working second mount. Rationale — it matches the library's soft-failure convention (warn, degrade, never throw), keeps the first mount authoritative so the caller's existing handle stays valid, and makes the duplicate strictly inert rather than half-live. Pin it with the test.

- [ ] **Step 1: Write the failing characterization test**

Add to `src/vanilla/__tests__/mount.test.ts`:

```ts
describe('mountWhichKey — double-mount guard [B32]', () => {
  it('warns and renders only one popup host for a repeated mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    wk.register('g a', vi.fn(), { description: 'Alpha' });

    const first = mountWhichKey(wk);
    const second = mountWhichKey(wk);
    wk.start();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[whichkey] mountWhichKey called twice'),
    );
    press('g');
    vi.advanceTimersByTime(500);
    expect(document.querySelectorAll('[data-testid="whichkey-popup"]')).toHaveLength(1);

    second.unmount(); // the no-op handle must not tear down the live mount
    press('?');
    expect(document.querySelector('.wk-cheatsheet')).not.toBeNull();

    first.unmount();
    wk.stop();
    warn.mockRestore();
  });

  it('allows a fresh mount after the first one unmounts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    const first = mountWhichKey(wk);
    first.unmount();
    warn.mockClear();

    const second = mountWhichKey(wk);
    expect(warn).not.toHaveBeenCalled();
    second.unmount();
    wk.stop();
    warn.mockRestore();
  });

  it('unmount is idempotent', () => {
    const wk = createWhichKey();
    const ui = mountWhichKey(wk);
    ui.unmount();
    expect(() => ui.unmount()).not.toThrow();
    wk.stop();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/vanilla/__tests__/mount.test.ts -t "B32"`
Expected: FAIL — no warning, two popup nodes, and `second.unmount()` tears down real DOM.

- [ ] **Step 3: Commit the RED test**

```bash
git add src/vanilla/__tests__/mount.test.ts
git commit -m "test: characterize duplicate mountWhichKey before fix [B32]"
```

- [ ] **Step 4: Apply the fix**

At module scope in `src/vanilla/mount.ts`:

```ts
// One live renderer per container. A second mount (hot reload, a route change
// that remounts without unmounting, two modules wiring the same engine) used
// to append a SECOND popup and cheatsheet — two nodes with the same
// data-testid and the same role="dialog" aria-label, an escape listener bound
// twice, and a first unmount() that left the second renderer live.
const mountedContainers = new WeakSet<HTMLElement>();
```

At the top of `mountWhichKey`, right after `const container = ...`:

```ts
if (mountedContainers.has(container)) {
  console.warn(
    '[whichkey] mountWhichKey called twice for the same container; ' +
      'the previous mount is still active. Call unmount() on it first. ' +
      'This call is a no-op.',
  );
  return { unmount() {} };
}
mountedContainers.add(container);
```

Make `unmount` idempotent and release the container:

```ts
let unmounted = false;
return {
  unmount() {
    if (unmounted) return;
    unmounted = true;
    mountedContainers.delete(container);
    unsubscribe();
    popupHost.remove();
    cheatsheetNode?.remove();
    cheatsheetDestroy?.();
    cheatsheetDestroy = null;
    document.removeEventListener('keydown', onEscape);
  },
};
```

Note the guard must sit **after** `container` is resolved but **before** any DOM is created or any subscription is taken, so a rejected call allocates nothing.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/vanilla/__tests__/mount.test.ts`
Expected: PASS. Note the existing suite mounts repeatedly across tests into `document.body`, which the `afterEach` clears via `document.body.innerHTML = ''` — that does _not_ clear the WeakSet. Every existing test already calls `ui.unmount()`, which does. If any test does not, add the `unmount()` call to it (a missing teardown, not a test refactor).

- [ ] **Step 6: Document it**

In `docs/API.md`, under the `mountWhichKey` section, add after the existing "Important" callout:

```markdown
> **One mount per container.** Calling `mountWhichKey` again for a container that already has a live renderer emits a `console.warn` and returns a no-op handle — the existing mount stays authoritative. Call `unmount()` before re-mounting. `unmount()` is idempotent.
```

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 8: Strip B32 from bughunt.md and commit**

```bash
git add src/vanilla/mount.ts src/vanilla/__tests__/mount.test.ts docs/API.md bughunt.md
git commit -m "fix(api-surface): warn and no-op on a duplicate mountWhichKey for one container [B32]

The duplicate call returns a no-op handle rather than a second working
renderer: it matches the library's soft-failure convention, keeps the
first mount authoritative so the caller's existing handle stays valid,
and makes the duplicate strictly inert rather than half-live."
```

> ### 🚩 Milestone after Task 20
>
> Run the full suite: `npm test`. Expected green. On red: bisect within Tasks 16–20, revert the offender, surface the diagnosis.

---

### Task 21: B36 — validate classPrefix and fall back to "wk"

**Files:**

- Modify: `src/vanilla/mount.ts:16` (the `prefix` resolution)
- Test: `src/vanilla/__tests__/mount.test.ts`
- Modify: `docs/API.md` (the `classPrefix` row, around line 325)
- Modify: `bughunt.md` (strip B36)

**Interfaces:**

- Consumes: `MountOptions.classPrefix?: string`.
- Produces: `prefix` is always a valid CSS identifier stem. An invalid value warns and falls back to `'wk'`.

**The bug:** `const prefix = opts.classPrefix ?? 'wk';` is interpolated raw into every className. A prefix containing a space (`'my app'`) produces `class="my app-popup my app-popup--vertical"` — four unrelated classes, none matching the consumer's stylesheet, so the popup renders completely unstyled with **no diagnostic**. Prefixes starting with a digit or containing `.`/`#`/`:` produce classes that are valid HTML but unselectable without escaping, so `.1x-popup { … }` silently never applies.

- [ ] **Step 1: Write the failing tests**

Add to `src/vanilla/__tests__/mount.test.ts`:

```ts
describe('mountWhichKey — classPrefix validation [B36]', () => {
  it.each(['my app', '1x', 'a.b', 'a#b', 'a:b', ''])(
    'warns and falls back to "wk" for %p',
    (bad) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const wk = createWhichKey();
      wk.register('g a', vi.fn(), { description: 'Alpha' });
      const ui = mountWhichKey(wk, { classPrefix: bad });
      wk.start();
      press('g');
      vi.advanceTimersByTime(500);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[whichkey] invalid classPrefix'));
      expect(document.querySelector('.wk-popup')).not.toBeNull();

      ui.unmount();
      wk.stop();
      warn.mockRestore();
    },
  );

  it('accepts a valid custom prefix without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const wk = createWhichKey();
    wk.register('g a', vi.fn(), { description: 'Alpha' });
    const ui = mountWhichKey(wk, { classPrefix: 'my-app_1' });
    wk.start();
    press('g');
    vi.advanceTimersByTime(500);

    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector('.my-app_1-popup')).not.toBeNull();

    ui.unmount();
    wk.stop();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npx vitest run src/vanilla/__tests__/mount.test.ts -t "B36"`
Expected: FAIL — no warning, and `.wk-popup` is absent because the popup carries the mangled prefix.

- [ ] **Step 3: Apply the fix**

Replace `src/vanilla/mount.ts:16`:

```ts
// The prefix is interpolated raw into every className, so a space splits one
// class into several ('my app' -> "my app-popup"), and a leading digit or a
// '.'/'#'/':' produces a class that is valid HTML but unselectable without
// escaping — either way the consumer's stylesheet silently never applies.
const CLASS_PREFIX_RE = /^-?[A-Za-z_][A-Za-z0-9_-]*$/;
const requestedPrefix = opts.classPrefix;
let prefix = 'wk';
if (requestedPrefix !== undefined) {
  if (CLASS_PREFIX_RE.test(requestedPrefix)) {
    prefix = requestedPrefix;
  } else {
    console.warn(
      `[whichkey] invalid classPrefix "${requestedPrefix}"; ` +
        'must be a valid CSS identifier stem (letters, digits, "-", "_"; not starting with a digit). ' +
        'Falling back to "wk".',
    );
  }
}
```

Hoist `CLASS_PREFIX_RE` to module scope rather than reallocating it per call.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/vanilla/__tests__/mount.test.ts`
Expected: PASS, including the existing `classPrefix: 'kbd'` test (valid, so unaffected).

- [ ] **Step 5: Document the constraint**

In `docs/API.md`, extend the `classPrefix` row's description in the `MountOptions` table:

```
Must be a valid CSS identifier stem (`/^-?[A-Za-z_][A-Za-z0-9_-]*$/`); an invalid value warns and falls back to `'wk'`.
```

- [ ] **Step 6: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 7: Strip B36 from bughunt.md and commit**

```bash
git add src/vanilla/mount.ts src/vanilla/__tests__/mount.test.ts docs/API.md bughunt.md
git commit -m "fix(api-surface): validate classPrefix and fall back to \"wk\" [B36]"
```

---

### Task 22: B25 — export PopupOptions and WhichKeyMountHandle from which-key/vanilla

**Files:**

- Modify: `src/vanilla/mount.ts` (add and use the `WhichKeyMountHandle` type)
- Modify: `src/vanilla/index.ts:1-2`
- Test: `src/engine/__tests__/package-exports.test.ts` or a new assertion in the vanilla suite
- Modify: `docs/API.md` (vanilla section)
- Modify: `bughunt.md` (strip B25)

**Interfaces:**

- Produces, from `which-key/vanilla`:
  - `export type { PopupOptions }` — `{ layout: 'vertical' | 'horizontal'; maxRows: number; backgroundOpacity: number }`
  - `export type WhichKeyMountHandle = { unmount(): void }`, and `mountWhichKey`'s declared return type becomes `WhichKeyMountHandle`.
- Both **additive** — existing structural usage keeps compiling.

**The bug:** `docs/API.md` types the `popup` option as `Partial<PopupOptions> | false` and gives `PopupOptions` its own table, but `src/vanilla/index.ts` only re-exports `mountWhichKey` and `MountOptions`. Confirmed in the shipped declarations: `dist/vanilla/index.d.ts` _declares_ `type PopupOptions` (it must, since `MountOptions` references it) but the terminal export list leaves it unnamed. A consumer writing `function popupCfg(): Partial<PopupOptions>` cannot import the type and must retype it by hand. Same gap for the return: an inline anonymous `{ unmount(): void }` with no exported alias, so a consumer cannot annotate the handle they hold.

- [ ] **Step 1: Write the failing test**

Add to `src/vanilla/__tests__/mount.test.ts` — a type-level test that only compiles if both names are importable:

```ts
import type { PopupOptions, WhichKeyMountHandle } from '../index';

describe('which-key/vanilla type exports [B25]', () => {
  it('exposes PopupOptions and WhichKeyMountHandle to consumers', () => {
    const popup: Partial<PopupOptions> = { layout: 'horizontal', maxRows: 3 };
    const wk = createWhichKey();
    const handle: WhichKeyMountHandle = mountWhichKey(wk, { popup });
    expect(typeof handle.unmount).toBe('function');
    handle.unmount();
    wk.stop();
  });
});
```

The real assertion is `npm run typecheck` — a missing export is a compile error, not a runtime one.

- [ ] **Step 2: Run to verify FAIL (RED)**

Run: `npm run typecheck`
Expected: FAIL — `Module '"../index"' has no exported member 'PopupOptions'` (and the same for `WhichKeyMountHandle`).

- [ ] **Step 3: Apply the fix**

In `src/vanilla/mount.ts`, add the named type and use it as the declared return:

```ts
export type WhichKeyMountHandle = { unmount(): void };

export const mountWhichKey = (
  engine: WhichKeyEngine, opts: MountOptions = {},
): WhichKeyMountHandle => {
```

In `src/vanilla/index.ts`:

```ts
export { mountWhichKey } from './mount';
export type { MountOptions, WhichKeyMountHandle } from './mount';
export type { PopupOptions } from './popup';
```

- [ ] **Step 4: Verify the built declarations name both**

Run: `npm run build`, then:

```bash
grep -n 'PopupOptions\|WhichKeyMountHandle' dist/vanilla/index.d.ts
```

Expected: both appear in the terminal `export { ... }` / `export type { ... }` list, not merely as internal declarations.

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm run typecheck && npx vitest run src/vanilla/__tests__/mount.test.ts`
Expected: PASS.

- [ ] **Step 6: Document both (required — named exports must be in docs/API.md)**

In `docs/API.md`, change the `mountWhichKey` heading and signature to name the handle:

```markdown
### `mountWhichKey(engine, options?) => WhichKeyMountHandle`
```

Update the TOC entry to match, and add after the `PopupOptions` table:

````markdown
**`WhichKeyMountHandle`** (the return value):

```ts
type WhichKeyMountHandle = { unmount(): void };
```
````

Both `PopupOptions` and `WhichKeyMountHandle` are exported as types from `which-key/vanilla`:

```ts
import type { MountOptions, PopupOptions, WhichKeyMountHandle } from 'which-key/vanilla';
```

````

- [ ] **Step 7: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 8: Strip B25 from bughunt.md and commit**

```bash
git add src/vanilla docs/API.md bughunt.md
git commit -m "fix(api-surface): export PopupOptions and WhichKeyMountHandle from which-key/vanilla [B25]"
````

---

## Group 7 — packaging & examples

### Task 23: B39 — correct the vanilla example's cheatsheet selectors

**Files:**

- Modify: `examples/vanilla/index.html` (inline `<style>` around lines 42–52; unpkg specifiers at 108–109)
- Modify: `bughunt.md` (strip B39)

**Interfaces:**

- Consumes: the class names emitted by `src/vanilla/cheatsheet.ts` and `src/vanilla/popup.ts`.
- Produces: a demo whose inline stylesheet matches the real class contract.

**The bug:** the inline demo CSS defines `.wk-cheatsheet__panel` — a class **no renderer emits** — and styles `.wk-cheatsheet` as the full-screen overlay. The actual markup is `.wk-backdrop > .wk-cheatsheet`, and `.wk-backdrop` gets no rule at all, so pressing `?` in this demo produces an unpositioned backdrop in normal flow containing a full-viewport black box with top-left-aligned unstyled text. Two smaller defects in the same file: line 42 adds `content: '+'` via `::before` on `.wk-row--group .wk-row__label`, but `popup.ts:21` already prepends `+` to the label text, so group rows show `++`; and lines 108–109 pin `which-key@0.1.0` from unpkg while the package is now at 0.2.0.

`examples/` is eslint-ignored and has no tests, so verification is by reading. **Do not add a test for this file** — it is a copy-paste starting point, not shipped code.

- [ ] **Step 1: Establish ground truth for the class names**

```bash
grep -n 'className\|class = \|\${p}-' src/vanilla/cheatsheet.ts src/vanilla/popup.ts | grep -o '\${p}-[a-z0-9_-]*' | sort -u
```

Expected set (normalized with `wk` as the prefix): `wk-backdrop`, `wk-cheatsheet`, `wk-cheatsheet__close`, `wk-cheatsheet__group-label`, `wk-cheatsheet__group-title`, `wk-cheatsheet__hint`, `wk-cheatsheet__item`, `wk-cheatsheet__list`, `wk-cheatsheet__list--nested`, `wk-cheatsheet__section`, `wk-cheatsheet__sections`, `wk-kbd`, `wk-popup`, `wk-popup__body`, `wk-popup__grid`, `wk-popup__header`, `wk-popup__list`, `wk-row`, `wk-row--group`, `wk-row__label`, `wk-sequence`, `wk-sequence__ellipsis`, plus `wk-popup-host` from Task 17.

- [ ] **Step 2: Fix the selectors in the inline stylesheet**

In `examples/vanilla/index.html`:

1. Rename the full-screen overlay rule's selector `.wk-cheatsheet` → `.wk-backdrop` (this is the rule with `position: fixed`/`inset`/dimmed background, around line 46).
2. Rename `.wk-cheatsheet__panel` → `.wk-cheatsheet` (the scrollable content box, around line 52).
3. Delete the `::before { content: '+' }` rule on `.wk-row--group .wk-row__label` (around line 42) — `popup.ts:21` already prepends `+`, so this renders `++`.
4. Change the two `which-key@0.1.0` unpkg specifiers (lines ~108–109) to `which-key@latest`.

- [ ] **Step 3: Verify every selector in the demo matches an emitted class**

```bash
grep -o '\.wk-[a-z0-9_-]*' examples/vanilla/index.html | sort -u
```

Cross-check each against the Step 1 list. Every demo selector must be in that set. If the demo styles a class the renderers do not emit, it is another instance of this bug — fix it in this task.

- [ ] **Step 4: Open the demo and confirm it renders (optional but preferred)**

The demo loads which-key from unpkg, so it needs network access. If available:

```bash
python3 -m http.server 8000 --directory examples/vanilla
```

then open `http://localhost:8000` and press `?`. Expect a centred, dimmed-backdrop cheatsheet panel with styled rows, and group rows showing a single `+`. If network access is unavailable, Step 3's mechanical cross-check is sufficient — say so in the commit rather than claiming a visual check you did not run.

- [ ] **Step 5: Verify nothing else broke**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: green. `examples/` is eslint-ignored so lint will not cover the file; that is expected, not a gap to fix here.

- [ ] **Step 6: Strip B39 from bughunt.md and commit**

```bash
git add examples/vanilla/index.html bughunt.md
git commit -m "fix(frontend): correct the vanilla example's cheatsheet selectors [B39]"
```

---

### Task 24: B43 — drop the dead .npmignore and fix the README API link

**Files:**

- Delete: `.npmignore`
- Modify: `README.md:254` (the `docs/API.md` link)
- Modify: `bughunt.md` (strip B43)

**Interfaces:**

- Produces: `package.json` `files` is the single source of truth for tarball contents; the README's "full reference" link resolves from a `node_modules` copy and from npmjs.com.

**The bug:** both `.npmignore` and `package.json` `files` are present; **`files` wins**, so `.npmignore` is dead config a future maintainer will edit expecting an effect. Verified via `npm pack --dry-run`: the tarball is exactly LICENSE, README.md, package.json and `dist/**` (18 files), so nothing needed is dropped. But `README.md:254` links `[docs/API.md](./docs/API.md)` and `docs/` is **not** in `files`, so the reference the README calls "the full reference" ships as a dangling relative link in the installed package and on npmjs.com.

**Choice, made deliberately:** use an absolute GitHub URL rather than adding `"docs"` to `files`. It keeps the tarball lean _and_ fixes rendering on npmjs.com, which a bundled file would not — npmjs.com renders the README but does not serve sibling files from the tarball.

- [ ] **Step 1: Record the baseline tarball contents**

```bash
npm pack --dry-run 2>&1 | tail -30
```

Save the file list. It must be identical after the change.

- [ ] **Step 2: Delete the dead config**

```bash
git rm .npmignore
```

- [ ] **Step 3: Fix the README link**

Find the repository URL:

```bash
node -e "console.log(require('./package.json').repository)"
```

In `README.md` around line 254, change:

```markdown
See **[docs/API.md](./docs/API.md)** for the full reference.
```

to an absolute URL pointing at the default branch, e.g.:

```markdown
See **[docs/API.md](https://github.com/stevenwcarter/which-key/blob/main/docs/API.md)** for the full reference.
```

Use the actual owner/repo from `package.json` `repository`, not a guess. Then check for any other relative link into `docs/` that ships in the README:

```bash
grep -n '](\./\|](docs/' README.md
```

Fix each the same way. Relative links to files that _are_ in `files` (there are none beyond the README itself) may stay.

- [ ] **Step 4: Verify the tarball is unchanged**

```bash
npm pack --dry-run 2>&1 | tail -30
```

Expected: byte-for-byte the same file list as Step 1 — LICENSE, README.md, package.json, `dist/**`. Deleting `.npmignore` must change nothing, which is the whole point of the finding.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm pack --dry-run`
Expected: all green.

- [ ] **Step 6: Strip B43 from bughunt.md and commit**

```bash
git add -A .npmignore README.md bughunt.md
git commit -m "chore(packaging): drop the dead .npmignore and fix the README API link [B43]"
```

---

## Group 8 — docs (last: they describe final behaviour)

### Task 25: B16 — document the layers API and correct ShortcutOptions drift

**Files:**

- Modify: `docs/API.md` — TOC (lines 3–22), `WhichKeyEngine` section (53–147), React section (194–290), `MountOptions` table (322)
- Modify: `bughunt.md` (strip B16)

**Interfaces:**

- Consumes: the real signatures in `src/engine/controller.ts` and `src/engine/types.ts` — **read them, do not trust the prose already in the file**.
- Produces: `docs/API.md` documents the complete public surface.

**The bug:** `README.md:254` calls `docs/API.md` "the full reference", but the `WhichKeyEngine` section documents register/registerGroup/start/stop/subscribe/getSnapshot/cheatsheet methods/cancel/registry — and **not** `pushLayer` or `activateLayer`. The React section and its TOC omit `<WhichKeyLayer>` and `WhichKeyLayerProps` entirely, though both are exported from `src/react/index.ts:4-5`. Further drift in the same file: the `ShortcutOptions` table omits the real `global` and `level` options; the `registerGroup` options table omits `level`; and the `popup` default is listed as `{}` when the real defaults are `{layout:'vertical', maxRows:5, backgroundOpacity:0.95}`. A consumer reading only the reference cannot discover layers at all.

**Docs-only — no test, no code change.**

- [ ] **Step 1: Read the real signatures**

```bash
sed -n '11,50p' src/engine/controller.ts     # WhichKeyOptions, LayerHandle, WhichKeyEngine
cat src/engine/types.ts                      # ShortcutOptions and friends
sed -n '1,25p' src/react/WhichKeyLayer.tsx   # WhichKeyLayerProps
```

Every signature you write must match these. The design rationale for layers lives in `docs/superpowers/specs/2026-06-17-keybinding-layers-design.md` — read it for the _why_ to put in the prose.

- [ ] **Step 2: Add the two engine methods and the LayerHandle type**

In the `WhichKeyEngine` section, after `#### engine.registerGroup(...)` and before `#### engine.start()`, add:

````markdown
#### `engine.pushLayer(options?) => LayerHandle`

Pushes a new keybinding layer and returns a handle that owns everything registered through it. This is the recommended way to scope shortcuts to a modal, drawer, or focused pane: `pop()` unregisters every shortcut and group the handle created **and** deactivates the layer, so there is no teardown bookkeeping to get wrong.

| Property    | Type      | Default                | Description                                                                                                     |
| ----------- | --------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `exclusive` | `boolean` | `false`                | When `true`, this layer raises the block level: entries at a lower level are unreachable unless `global: true`. |
| `level`     | `number`  | `registry.nextLevel()` | Explicit level ordinal. Must be a non-negative integer; an invalid value warns and falls back to the default.   |

```ts
const layer = engine.pushLayer({ exclusive: true });
layer.register('Escape', close, { description: 'Close dialog' });
layer.registerGroup('g', { description: 'Go to' });
// later:
layer.pop(); // unregisters both, then deactivates the layer
```
````

**`LayerHandle`**

```ts
type LayerHandle = {
  readonly level: number;
  register(keys: string, handler: ShortcutHandler, options?: ShortcutOptions): () => void;
  registerGroup(
    prefix: string,
    options: { description: string; priority?: number; level?: number },
  ): () => void;
  pop(): void;
};
```

`register` and `registerGroup` behave exactly like the engine methods of the same name, except that each stamps this handle's `level` onto the registration and tracks it for `pop()`.

#### `engine.activateLayer(level, exclusive) => () => void`

Lower-level primitive: activates a layer at an explicit level without owning any registrations. Returns a deactivate function that is safe to call more than once. Prefer `pushLayer` unless you are managing registration lifetimes yourself.

```ts
const deactivate = engine.activateLayer(1, true);
// ... later
deactivate();
```

```

- [ ] **Step 3: Correct the ShortcutOptions table**

In the `engine.register` section, add the two missing rows to the `ShortcutOptions` table (match the existing column layout exactly, and confirm the types against `src/engine/types.ts`):

```

| `global` | `boolean` | `false` | When `true`, this shortcut stays reachable even under an active exclusive layer. |
| `level` | `number` | `0` | Layer level this registration belongs to. Normally set for you by `pushLayer` / `<WhichKeyLayer>`. |

```

- [ ] **Step 4: Correct the registerGroup table**

Add to the `engine.registerGroup` options table:

```

| `level` | `number` | `0` | Layer level this group belongs to. Normally set for you by `pushLayer` / `<WhichKeyLayer>`. |

````

- [ ] **Step 5: Add the `<WhichKeyLayer>` React section**

In the React section, after `### useShortcutGroup(prefix, options)` (or wherever it fits the existing order — match the order in `src/react/index.ts`), add:

```markdown
### `<WhichKeyLayer>`

Scopes every `useShortcut` / `useShortcutGroup` call in its subtree to a nested keybinding layer. Mount it around a modal or focused pane; unmounting it deactivates the layer.

```tsx
<WhichKeyLayer exclusive>
  <Dialog />
</WhichKeyLayer>
````

**Props** (`WhichKeyLayerProps`):

| Prop        | Type        | Default    | Description                                                                                      |
| ----------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `children`  | `ReactNode` | (required) | Subtree whose shortcuts belong to this layer.                                                    |
| `exclusive` | `boolean`   | `false`    | When `true`, shortcuts at lower levels become unreachable unless registered with `global: true`. |

The layer's level is derived from React tree depth (`parent.level + 1`), so nesting `<WhichKeyLayer>` components stacks levels. Note that two **sibling** layers under the same parent share a level and therefore do not isolate from each other.

```

That last sentence is factual and matters to consumers — it is the behaviour recorded in one of the `decision-needed` markers in `bughunt.md`. Document the current behaviour; do not change it.

- [ ] **Step 6: Update the table of contents**

Add to the TOC (lines 3–22), keeping the existing anchor-slug style:

```

- [`engine.pushLayer(options?)`](#enginepushlayeroptions--layerhandle)
- [`engine.activateLayer(level, exclusive)`](#engineactivatelayerlevel-exclusive---void)

```
under the Engine group, and:
```

- [`<WhichKeyLayer>`](#whichkeylayer)

```
under the React group. Verify each anchor by the heading text it targets — GitHub slugs lowercase the heading, drop punctuation other than hyphens, and replace spaces with hyphens.

- [ ] **Step 7: Correct the `popup` default**

In the `MountOptions` table (around line 322), change the `popup` row's Default cell from `{}` to:

```

`{ layout: 'vertical', maxRows: 5, backgroundOpacity: 0.95 }`

````

Confirm against `src/vanilla/mount.ts` (after Task 16 those defaults come from `DEFAULT_MAX_ROWS`/`DEFAULT_BACKGROUND_OPACITY`, with the same values).

- [ ] **Step 8: Fold in the doc notes owed by earlier tasks**

Tasks 8, 10, 11, 12 each added a soft-failure. Re-read those sections and confirm each note landed; add any that did not:
- `engine.register` — invalid key string / non-function handler warns and no-ops (Task 8).
- `createWhichKey` `helpKey` row — invalid value warns and disables the help shortcut (Task 10).
- `createWhichKey` `timeoutMs` row — non-finite/negative warns and falls back to 500 (Task 11).
- `engine.pushLayer` `level` row — invalid value warns and falls back (Task 12, covered by the table in Step 2).

- [ ] **Step 9: Cross-check the whole file against the source**

```bash
grep -n 'export ' src/engine/index.ts src/react/index.ts src/vanilla/index.ts
````

Every named export in those three files must appear in `docs/API.md` — that is the CLAUDE.md rule. Anything that does not is either a doc gap to fill here or a deliberate "advanced/unstable" item covered by a `decision-needed` marker; if you find one not covered by either, note it in the commit body rather than silently skipping it.

- [ ] **Step 10: Verify**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: green (docs-only, but the suite must stay green).

Also verify the TOC anchors resolve — check each new `(#…)` target against its heading by eye, or render the file locally.

- [ ] **Step 11: Strip B16 from bughunt.md and commit**

```bash
git add docs/API.md bughunt.md
git commit -m "docs(api): document the layers API and correct ShortcutOptions drift [B16]"
```

> ### 🚩 Milestone after Task 25
>
> Run the full suite: `npm test`. Expected green. On red: bisect within Tasks 21–25, revert the offender, surface the diagnosis.

---

### Task 26: B28 — document the key-canonicalization debugging exports

**Files:**

- Modify: `docs/API.md` (add a Debugging section; expand `engine.registry` at line 142; add a TOC entry)
- Modify: `bughunt.md` (strip B28)

**Interfaces:**

- Consumes: `parseKey`, `parseSequence`, `eventToCanonical` — **already exported** from `src/engine/index.ts:2` and re-exported through `which-key/react`. No code change.
- Produces: a Debugging section other docs can link to (Task 28's Troubleshooting checklist points at it).

**The bug:** the three things that silently kill a shortcut — a canonicalization mismatch, an exclusive layer raising `blockLevel`, and a higher-level entry winning `findActive` — are all unobservable from the public API. `docs/API.md:142-144` documents `engine.registry` as nothing more than "Read-only reference to the underlying ShortcutRegistry. Advanced use only." with no members listed, so a developer cannot tell whether `getAllActive()` is supported or internal. Meanwhile `parseKey` and `eventToCanonical` are already exported and are exactly the tool needed — `parseKey('Shift+/')` immediately reveals a `/` mismatch — but neither appears anywhere in `docs/API.md` or `README.md`, so nobody knows they exist.

**Explicitly out of scope:** a richer `registry.explain(keys)` returning _why_ a binding is unreachable. That is a new public method, not a doc fix.

- [ ] **Step 1: Verify the exports and their real signatures**

```bash
grep -n 'export const parseKey\|export const parseSequence\|export const eventToCanonical' src/engine/keys.ts
grep -n 'getAllActive' src/engine/registry.ts
```

Write the documented signatures from these, not from memory.

- [ ] **Step 2: Add the Debugging section**

Add a new top-level section to `docs/API.md`, after "Key-string syntax" and before "CSS class contract":

````markdown
## Debugging

When a shortcut "just doesn't fire", it is almost always one of three things: the key string canonicalizes differently than the runtime event, an exclusive layer is blocking it, or another registration is winning. These exports let you check each from the console.

### `parseKey(keys)` / `parseSequence(keys)`

Canonicalize a key string exactly the way registration does. `parseKey` handles a single chord; `parseSequence` splits on spaces and returns an array of chords.

```ts
import { parseKey, parseSequence } from 'which-key';

parseKey('Shift+/'); // '?'   — the shifted glyph IS the base char
parseKey('n'); // 'N'
parseKey('Mod+k'); // 'Cmd+K' on macOS, 'Ctrl+K' elsewhere
parseSequence('g h'); // ['g', 'h']
```
````

Both throw for an unparseable string, which is how you tell a typo from a mismatch. (The engine's own `register` catches that and warns instead — see [`engine.register`](#engine-register).)

### `eventToCanonical(event)`

Canonicalize a live `KeyboardEvent` the way the matcher does at runtime. **Registration and runtime must produce byte-identical strings** — registry lookups are plain `Map` gets — so comparing the two is the fastest way to find a mismatch:

```ts
import { parseKey, eventToCanonical } from 'which-key';

document.addEventListener('keydown', (e) => {
  console.log('pressed:', eventToCanonical(e), 'registered:', parseKey('Shift+/'));
});
```

If those two strings differ, that is your bug.

### `engine.registry.getAllActive()`

Lists every shortcut currently winning its bucket — i.e. what would actually fire right now, after level, priority and layer blocking are resolved. Use it to confirm a binding is live and to see which entry won a collision:

```ts
console.table(
  engine.registry.getAllActive().map((e) => ({
    keys: e.keys,
    description: e.description,
    level: e.level,
    priority: e.priority,
  })),
);
```

A shortcut you registered that is **absent** from this list is being blocked by an active exclusive layer (register it with `global: true` to punch through) or has lost its bucket to a higher-level or higher-priority entry.

````

- [ ] **Step 3: Expand the `engine.registry` entry**

At `docs/API.md:142`, replace the bare "Advanced use only." prose with a pointer to the new section and an explicit statement of what is supported:

```markdown
#### `engine.registry`

Reference to the underlying `ShortcutRegistry`. Advanced use only — treat it as read-only. The supported read method is `getAllActive()`, documented under [Debugging](#debugging). The mutating methods (`register`, `unregister`, `activateLayer`) exist on the class but are driven by the engine; calling them directly bypasses the engine's bookkeeping.
````

- [ ] **Step 4: Add the TOC entry**

Add `Debugging` to the numbered list in the TOC, renumbering the entries after it (Key-string syntax and CSS class contract). Verify the `#debugging` anchor.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

Also verify every code sample compiles conceptually against the real exports — in particular that `parseKey('Shift+/')` really does return `'?'`:

```bash
npx vitest run src/engine/__tests__/keys.test.ts -t "Shift"
```

If any sample's stated output disagrees with the tests, the **sample** is wrong — fix it.

- [ ] **Step 6: Strip B28 from bughunt.md and commit**

```bash
git add docs/API.md bughunt.md
git commit -m "docs(api): document the key-canonicalization debugging exports [B28]"
```

---

### Task 27: B33 — document that classPrefix opts out of the shipped stylesheet

**Files:**

- Modify: `README.md` (Styling section, around line 243)
- Modify: `docs/API.md` (the `classPrefix` row, around line 325)
- Modify: `bughunt.md` (strip B33)

**Interfaces:** none — docs only.

**The bug:** `classPrefix` threads correctly through every vanilla class (verified: all 23 class writes use the `${p}-` template, none hardcoded), but `src/styles.css` hardcodes `.wk-*` in all 24 selectors. So `mountWhichKey(wk, { classPrefix: 'myapp' })` **plus** the README's own `import 'which-key/styles.css'` yields a completely unstyled overlay: the backdrop loses `position:fixed; inset:0`, the popup loses `position:fixed`, and both render inline in the body flow. `README.md:243-247` shows the two side by side with no warning they are mutually exclusive; the only hint is a passing mention in `docs/API.md`. Separately, the React renderer hardcodes `wk-` in all 18 className literals with no prop to change it.

- [ ] **Step 1: Add the warning to the README**

In the Styling section, immediately after the "Custom `classPrefix` example (vanilla only):" code block (around line 243–247), add:

```markdown
> **`classPrefix` opts you out of `which-key/styles.css` entirely.** The shipped stylesheet hardcodes `.wk-*` in every selector, so a custom prefix matches none of it — the popup and backdrop lose even their `position: fixed`, and everything renders inline in the body flow. If you set `classPrefix`, supply your own stylesheet covering the whole class table above. Do not import `which-key/styles.css` alongside it and expect a partial effect; there is none.
>
> `classPrefix` is **vanilla-only**. The React components always emit `wk-`.
```

- [ ] **Step 2: Add the same constraint to docs/API.md**

Extend the `classPrefix` row in the `MountOptions` table. After Task 21 the row already documents the validation regex; append:

```
Setting it opts out of `which-key/styles.css` (which hardcodes `.wk-*`) — supply your own stylesheet. Vanilla only; the React components always emit `wk-`.
```

- [ ] **Step 3: Check the README does not contradict itself elsewhere**

```bash
grep -n 'classPrefix' README.md docs/API.md
```

Every mention must be consistent with the new note. In particular, if the Styling intro says classes use "the `wk-` prefix (or whatever you pass as `classPrefix` to `mountWhichKey`)", that phrasing implies the shipped sheet follows the prefix — reword it to make clear the _contract_ follows the prefix while the _shipped stylesheet_ does not.

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 5: Strip B33 from bughunt.md and commit**

```bash
git add README.md docs/API.md bughunt.md
git commit -m "docs(styling): document that classPrefix opts out of the shipped stylesheet [B33]"
```

---

### Task 28: B35 — add a README troubleshooting section and warning reference

**Files:**

- Modify: `README.md` (new `## Troubleshooting` section, before `## API` at line 263)
- Modify: `docs/API.md` (a warnings subsection under Debugging)
- Modify: `bughunt.md` (strip B35)

**Interfaces:**

- Consumes: **every** `console.warn` in `src/` as it exists after Tasks 1–27.
- Produces: the documentation entry point for "nothing happens".

**The bug:** neither `README.md` nor `docs/API.md` mentions the string `[whichkey]` or the word "warn" anywhere. A developer who sees `[whichkey] Shortcut "j" registered while another is active…` has no documentation telling them whether it is expected (it is, for the layer pattern the same README teaches). Symmetrically, the failure modes that produce **no output at all** — a key string that canonicalizes differently than the runtime event, a binding shadowed by an exclusive layer, a shortcut suppressed because focus is in an input — are never listed together as things to check. For a library whose entire failure mode is "nothing happens", this is the difference between a five-minute fix and an abandoned integration.

**This task runs LAST because it must enumerate every warning in the final tree.**

- [ ] **Step 1: Enumerate every warning in the final tree**

```bash
grep -rn 'console\.warn' src/ --include='*.ts' --include='*.tsx' | grep -v '__tests__'
```

Expect roughly ten sites after this batch: the pre-existing same-level collision warn in `registry.ts`; the unified `warnNoProvider` in `context.ts` (Task 15); and the new ones from `register` invalid key string / non-function handler (Task 8), `registerGroup` invalid prefix (Task 9), invalid `helpKey` (Task 10), invalid `timeoutMs` (Task 11), invalid and undercutting `pushLayer` level (Task 12), duplicate `mountWhichKey` (Task 20), and invalid `classPrefix` (Task 21).

**Copy each message verbatim.** Do not paraphrase — a developer will paste the string they saw into a search.

- [ ] **Step 2: Add the README Troubleshooting section**

Insert before `## API` (line 263):

````markdown
## Troubleshooting

which-key's failure mode is almost always "nothing happens". Work down this list.

**1. Is `<WhichKeyProvider>` an ancestor, and did you call `engine.start()`?**
The React hooks and both renderer components warn on the console when they are used outside the provider. The engine does not attach its `keydown` listener until `start()` is called — `mountWhichKey` deliberately does **not** call it for you.

**2. Is focus in a text field?**
Shortcuts are suppressed while focus is in an `<input>`, `<textarea>` or `contenteditable` element unless you register them with `enableOnInputs: true`.

**3. Does your key string canonicalize to what the browser actually reports?**
This is the most common silent failure. Registration and runtime both funnel through the same canonicalizer and the registry looks up plain strings, so a mismatch means the lookup simply misses:

```ts
import { parseKey, eventToCanonical } from 'which-key';

document.addEventListener('keydown', (e) => {
  console.log('pressed:', eventToCanonical(e), 'registered:', parseKey('Shift+/'));
});
```
````

If those two differ, that is your bug. Watch for: letters uppercase under any modifier (`parseKey('ctrl+k')` → `'Ctrl+K'`); `Shift+` dropped when the shifted glyph is already the base char (`'Shift+/'` → `'?'`); and special key names being **case-sensitive and exact** — `'escape'`, `'esc'`, `'up'` and `'f1'` all register successfully but can never match, because the runtime reports `'Escape'`, `'ArrowUp'` and `'F1'`. Use the exact `KeyboardEvent.key` spelling.

**4. Is an exclusive layer active?**
An exclusive layer makes every shortcut below its level unreachable. Register with `global: true` to punch through, or check what is live with `engine.registry.getAllActive()`.

**5. Is another registration winning?**
Multiple components may bind the same key. The winner is decided by **level, then priority, then most-recent registration**. A same-level collision emits a console warning naming both entries; raise the loser's `priority` or unregister one.

### Console warnings

which-key writes diagnostics to the console prefixed with `[whichkey]`. They are advisory — none of them throws. See the [warning reference](https://github.com/stevenwcarter/which-key/blob/main/docs/API.md#console-warnings) for what each one means.

````

Use the real repository URL from `package.json` for that last link, matching the form Task 24 established.

- [ ] **Step 3: Add the warning reference to docs/API.md**

Add a `### Console warnings` subsection at the end of the Debugging section (created in Task 26):

```markdown
### Console warnings

Every diagnostic is prefixed `[whichkey]`. All of them are advisory — the library soft-fails on consumer misuse rather than throwing, so a warning means "this did not do what you meant", never "your app is about to crash".

| Warning (abridged) | Meaning | Fix |
|---|---|---|
| `Shortcut "…" has a same-level collision: … wins over …` | Two live entries at the same level bound the same key. | Expected when using layers deliberately. Otherwise raise the loser's `priority` or unregister one. |
| `… used outside <WhichKeyProvider>` | A hook or renderer component has no provider ancestor. | Wrap your app in `<WhichKeyProvider>`. |
| `invalid key string "…": …; shortcut not registered` | `register` could not parse the key string. | Fix the key string; see [Key-string syntax](#key-string-syntax). |
| `handler for "…" is not a function; shortcut not registered` | A non-function was passed as the handler. | Pass a function. |
| `invalid group prefix "…": …; group not registered` | `registerGroup` could not parse the prefix. | Fix the prefix. |
| `invalid helpKey "…": …; help shortcut disabled` | `createWhichKey`'s `helpKey` could not be parsed. | Fix it, or pass `helpKey: null` to disable deliberately. |
| `invalid timeoutMs …; falling back to 500ms` | `timeoutMs` was non-finite or negative. | Pass a non-negative finite number. |
| `invalid pushLayer level …; expected a non-negative integer` | An explicit `level` was not a non-negative integer. | Omit `level` and let `pushLayer` allocate one. |
| `pushLayer level … undercuts the next free level …` | An explicit `level` sits below the active stack. | Usually a mistake — omit `level`. |
| `mountWhichKey called twice for the same container` | A second renderer was mounted on a container that already has one. | Call `unmount()` on the first, or mount into a different container. |
| `invalid classPrefix "…"; falling back to "wk"` | `classPrefix` is not a valid CSS identifier stem. | Use letters, digits, `-` and `_`, not starting with a digit. |

**Silent failures** — these produce no output at all, so check them by hand:

- A key string that canonicalizes differently than the runtime event (see [`eventToCanonical`](#eventtocanonicalevent)). In particular, special-key base names are case-sensitive and exact: `'escape'`, `'esc'`, `'up'`, `'f1'` register successfully but can never match a real event.
- A binding shadowed by an active exclusive layer (see [`engine.registry.getAllActive()`](#engineregistrygetallactive)).
- A shortcut suppressed because focus is in a text field and `enableOnInputs` is `false`.
````

Every row's text must match the real message from Step 1. If a message you wrote in an earlier task reads badly here, **fix the message in the source** and re-run that task's tests — this is the last chance to make the consumer-facing copy coherent.

Note the deliberate mention of B15 (lowercase/aliased special-key names). B15 itself is **out of scope and stays in `bughunt.md`**, but consumers can still hit it today, so documenting the trap is correct — and is not a fix, so B15 remains open.

- [ ] **Step 4: Verify the anchors and the message text**

```bash
grep -rn 'console\.warn' src/ --include='*.ts' --include='*.tsx' | grep -v '__tests__' | wc -l
grep -c '^| \`' docs/API.md   # sanity-check the table populated
```

Every warning found in Step 1 must have a row. Cross-check each abridged message against the source string character by character for the part you quoted.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Strip B35 from bughunt.md and commit**

```bash
git add README.md docs/API.md bughunt.md
git commit -m "docs(troubleshooting): add a README troubleshooting section and warning reference [B35]"
```

---

## Final verification

- [ ] **Step 1: Confirm bughunt.md holds exactly what it should**

```bash
grep -n '^### B\|decision-needed' bughunt.md
```

Expected: **exactly two** `### B` headings — **B15** and **B41** — plus the **7** `decision-needed` markers. Nothing else. Any other `### B` heading means a fix commit forgot to strip its finding.

```bash
grep -c '\[x\] execute' bughunt.md
```

Expected: `0`.

- [ ] **Step 2: Update the "Last triage" line**

`bughunt.md:3` still describes the previous batch. Update it to record this one, e.g.:

```
Last triage: 2026-08-21 against `codehealth/2026-08-21` @ bfbb4cc. B1-B13 executed and stripped 2026-08-21; B14, B16-B40, B42-B43 executed and stripped 2026-08-21 on `codehealth/2026-08-21-batch2`; B15, B41 and the 7 decision-needed markers remain open. Toolchain: npm run build / npm test / npm run lint.
```

Commit with the last finding's commit if it is still uncommitted, or as `docs(code-health): record the B14-B43 batch in bughunt.md`.

- [ ] **Step 3: Run the full suite one final time**

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm pack --dry-run
```

Expected:

- lint: 0 errors, 0 warnings
- typecheck: clean
- tests: all passing, with **more** than the 244 baseline (this batch adds roughly 40 tests)
- coverage: at or above the 80% gate on lines / statements / functions / branches. It starts at ~98.8% lines / ~94.6% branches — a large drop means a fix shipped untested; investigate rather than lowering the gate.
- build: green
- `npm pack --dry-run`: LICENSE, README.md, package.json, `dist/**`

- [ ] **Step 4: Review the commit log**

```bash
git log --oneline main..HEAD
```

Expected: 28 `fix`/`docs`/`chore`/`perf` commits (one per finding), plus 7 `test:` characterization commits for the high-risk findings — 35 commits. Each fix commit's diff must touch `bughunt.md`.

**No summary commit.** The per-finding commits are the audit trail.

## Definition of done

- All 28 findings fixed, each with its own commit, each stripping its own block from `bughunt.md` in that same commit.
- `bughunt.md` contains only the header/how-to-use preamble (with an updated "Last triage" line), **B15**, **B41**, and the 7 `decision-needed` markers.
- No `decision-needed` marker was auto-applied. If any task turned out to require a big rewrite, a public-API signature break, or an architectural change, it was converted to a new `decision-needed` marker and skipped — and that is called out explicitly in the final report.
- `npm run lint && npm run typecheck && npm test && npm run build` all green.
- `npm pack --dry-run` still produces LICENSE, README.md, package.json and `dist/**`.
