# TIDY.md — code cleanup findings

Last triage: 2026-08-22 against `main` @ e3f3360. Toolchain: npm run build / npm run lint / npm test.

> **For future sessions reading this file:** when you fix an item listed
> here, strip it from this file in the same commit that fixes it. The list
> is intended to reflect open issues only; resolved items shouldn't linger.
> This keeps the file's signal-to-noise high for the next tidy pass.

## How to use this file

- Check `[x] execute` on items to run this batch.
- Check `[x] skip` on items to never re-flag (the skill records them in user memory).
- Items left unchecked stay in TIDY.md for the next run.
- When ready, run `/tidy --execute`.

## High severity

## Medium severity

### T13. Four terminal branches inline, with the popup refresh-or-hide decision written twice: `Matcher.handleKeyDown` (src/engine/matcher.ts:48-175, 127 lines)

- Lenses: long-methods
- Risk: low
- Proposed fix: Split into private methods on `Matcher`, each already self-terminating with a `return` today: `private resolveEventTarget(event: KeyboardEvent): EventTarget | null` (lines 53-57, the composedPath logic), `private fireLeafNow(leaf, event, target): void` (73-86), `private scheduleLeafFire(leaf, event, prospective, target): void` (88-134), `private schedulePopup(prospective: string[], target): void` (136-170), plus `private syncVisiblePopup(): void` for the duplicated `if (this.popupVisible) { tainted ? hide : refresh }` block at 97-109 / 150-159. `handleKeyDown` then reads as guard clauses plus a four-way dispatch. All new members are private, so the published `Matcher`/`handleKeyDown` signature is unchanged. If the state machine is better kept in one place, the fallback is section comments (`// --- branch 1: pure leaf ---` etc.) — but the `syncVisiblePopup` extraction is worth doing either way.
- [ ] execute [ ] skip

### T17. 145-line component mixing subscription, focus trap, memo and JSX: `ShortcutCheatsheet` (src/react/ShortcutCheatsheet.tsx:25-169)

- Lenses: long-methods
- Risk: low
- Proposed fix: Extract a module-private hook in the same file, `const useCheatsheetFocusTrap = (panelRef: RefObject<HTMLDivElement | null>, active: boolean, onEscape: () => void): void`, holding lines 41-77 verbatim — same document-level listener, same Escape call, no semantic change (the modality/Escape-propagation question is bughunt's open decision-needed marker and must not be touched here). Also extract a module-private `const EntryRow = ({ entry }: { entry: CheatsheetEntry }) => …` for the `<li>` markup duplicated at 138-143 and 155-160, and `const GroupSection = ({ group }: { group: CheatsheetGroup }) => …` for 146-163. The body drops to roughly 40 lines. Keep the two long explanatory comments on the `useMemo` — they document a real invariant. Sequencing: T16 extracts the shared `trapTab` body this hook should call, and T19 replaces the store-subscription lines the component opens with — do T16 and T19 first, then this one.
- [x] execute [ ] skip

### T19. `useSyncExternalStore` no-provider boilerplate written twice with two different sentinels (src/react/useWhichKeyState.ts:5-23 and src/react/ShortcutCheatsheet.tsx:14-15,27-31,37-39)

- Lenses: duplication, idioms
- Risk: medium
- Proposed fix: Merged deliberately from two lens findings that name the same extraction from opposite ends (they are in different files and more than 2 lines apart, so mechanical dedup would have kept them separate). useWhichKeyState.ts declares `EMPTY: WhichKeySnapshot` + `getEmptySnapshot` + `noopSubscribe` + the `if (!engine) warnNoProvider(what)` effect + the three-arg `useSyncExternalStore(...)`; ShortcutCheatsheet.tsx declares the same four constructs inline but with a `null` sentinel and `getNullSnapshot`, which is what forces line 32's `snapshot?.cheatsheet.visible ?? false`. Extract a module-private `src/react/useEngineSnapshot.ts` (not added to src/react/index.ts, so no public-API change) exporting `useEngineSnapshot(engine: WhichKeyEngine | null, what: string): WhichKeySnapshot`, holding the hoisted `EMPTY`, `noopSubscribe`, `getEmptySnapshot`, the warn effect and the subscription. `useWhichKeyState` keeps only its `useMemo` projection; `ShortcutCheatsheet` reads `useEngineSnapshot(engine, …).cheatsheet.visible` with no optional chain. **Critical invariant:** the fallback must remain a single hoisted object, never a fresh literal per call — otherwise the `getSnapshot`/`getServerSnapshot` identity rule in CLAUDE.md breaks and `useSyncExternalStore` re-renders forever. Unifying the cheatsheet onto `EMPTY` is behaviorally equivalent (it only reads `.cheatsheet.visible`, false either way). Verify against src/react/**tests**/ssr.test.tsx.
- [x] execute [ ] skip

### T20. 102-line DOM builder with no internal structure: `renderCheatsheet` (src/vanilla/cheatsheet.ts:23-124)

- Lenses: long-methods
- Risk: medium
- Proposed fix: Extract three module-private helpers beside the existing `kbd`/`item`: `const buildPanel = (p: string, onClose: () => void): { panel: HTMLElement; backdrop: HTMLElement }` (lines 28-54: backdrop, panel, close button, title), `const buildSections = (p: string, model: CheatsheetModel): HTMLElement` (56-83, with a nested `const buildGroupSection = (p, g)` for the group body at 65-83), and `const installFocusTrap = (panel: HTMLElement): (() => void)` (94-121, returning the teardown that removes the listener and restores focus). `renderCheatsheet` becomes ~12 lines of assembly. Keep the existing NB comment about focus not being moved here. Sequencing: `installFocusTrap` should call T16's shared `trapTab`, and T33 replaces the literal copy strings inside `buildPanel`/`buildSections` — land T16 first, T33 either before or after but not concurrently.
- [x] execute [ ] skip

### T21. 111-line function with a 33-line nested render closure: `mountWhichKey` (src/vanilla/mount.ts:28-138)

- Lenses: long-methods
- Risk: low
- Proposed fix: Extract two pure module-private helpers: `const resolveClassPrefix = (requested: string | undefined): string` (lines 44-57, the `CLASS_PREFIX_RE` test and warn) and `const resolvePopupOptions = (popup: MountOptions['popup']): PopupOptions | null` (59-66). Then split the render closure into two named closures declared beside it — `const renderPopupInto = (snap: WhichKeySnapshot): void` (90-99) and `const syncCheatsheet = (snap: WhichKeySnapshot): void` (101-118) — leaving `render` three lines long. The cheatsheet-sync closure is exactly the code bughunt B49 proposes to change (the vanilla cheatsheet never refreshes while open); do this extraction strictly before or after B49, never concurrently.
- [x] execute [ ] skip

### T22. Cast where the same codebase uses the generic overload: `querySelector(...) as HTMLElement | null` (src/vanilla/mount.ts:109)

- Lenses: idioms
- Risk: low
- Proposed fix: src/vanilla/cheatsheet.ts:98 and src/react/ShortcutCheatsheet.tsx:54 both spell this `panel.querySelectorAll<HTMLElement>(FOCUSABLE)`; only this site casts. `querySelector` is generic in exactly the same way — ``cheatsheetNode.querySelector<HTMLElement>(`.${prefix}-cheatsheet`)?.focus();`` — and the wrapping parens go away too.
- [x] execute [ ] skip

### T23. `kbd()` copy-pasted between the vanilla renderers, and the create/className/textContent triple written ~18 more times (src/vanilla/popup.ts:10-15 and src/vanilla/cheatsheet.ts:6-11)

- Lenses: duplication, idioms
- Risk: low
- Proposed fix: The two `kbd` helpers are byte-identical, and both files then repeat `document.createElement(tag)` + `.className =` + optional `.textContent =` (8 times in popup.ts:17-38,46-81, 10 times in cheatsheet.ts:13-89). Add a module-private `src/vanilla/dom.ts` (not re-exported from src/vanilla/index.ts, so no public-API change):

  ```ts
  export const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
  ): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  export const kbd = (p: string, text: string): HTMLElement => el('kbd', `${p}-kbd`, text);
  ```

  Then e.g. popup.ts:21-22 becomes ``const label = el('span', `${p}-row__label`, …)`` and cheatsheet.ts:50-53 becomes ``const title = el('h2', `${p}-cheatsheet__title`, 'Keyboard shortcuts');``. The `kbd` half is the true cross-file dupe and is the minimum change; the ~18 `el()` conversions are a bigger diff and can land separately. No `innerHTML` is introduced — every helper keeps using `textContent`, already the project's consistent choice.

- [x] execute [ ] skip

## Low severity

### T30. Group labels have no `global` escape hatch from an exclusive layer: `getActiveGroup` (src/engine/registry.ts:133)

- Lenses: opportunistic
- Risk: high — needs characterization tests first
- Proposed fix: decision-needed: `GroupEntry` has no `global` field, so `getActiveGroup` blocks a group label at `level < blockLevel()` even when the shortcuts under that prefix remain reachable via `global: true` — an exclusive layer can therefore leave a still-firing shortcut with its prefix label missing from the popup and cheatsheet. Closing the asymmetry means adding `global` to the public `GroupEntry`/group-registration options and deciding whether group labels _should_ follow their shortcuts through a layer block; that is a semantics + public-API call, not a mechanical tidy. Note T15 extracts the shared winner cascade across `findActive`/`getActiveGroup` and must deliberately preserve this asymmetry until it is decided.
- [ ] execute [ ] skip

### T31. Cast and defensive optional call compensating for each other: `document.activeElement as HTMLElement | null` (src/react/ShortcutCheatsheet.tsx:43)

- Lenses: idioms
- Risk: low
- Proposed fix: `document.activeElement` is `Element | null`; the cast asserts something the runtime does not guarantee (an `SVGElement` or bare `Element` both reach here), which is why the restore call at line 75 is written `restoreRef.current?.focus?.()`. An `instanceof` narrow removes both: `const active = document.activeElement; restoreRef.current = active instanceof HTMLElement ? active : null;` and then plain `restoreRef.current?.focus();`. The identical two-line pattern at src/vanilla/cheatsheet.ts:94 and :121 should be changed in the same pass — that pair is the save/restore half T16 deliberately leaves in each renderer.
- [x] execute [ ] skip

### T32. `Kbd` component declared identically in both React renderers (src/react/WhichKeyPopup.tsx:13 and src/react/ShortcutCheatsheet.tsx:12)

- Lenses: duplication
- Risk: low
- Proposed fix: Both files declare the same `({ children }: { children: ReactNode }) => <kbd className="wk-kbd">{children}</kbd>`. Move it to a module-private `src/react/Kbd.tsx` and import from both; do not add it to src/react/index.ts — keeping it unexported avoids a public-API change and puts the `wk-kbd` string at exactly one place on the React side, which src/**tests**/class-contract.test.tsx already polices.
- [x] execute [ ] skip

### T33. User-visible copy both renderers must keep identical, inlined at nine sites (src/vanilla/cheatsheet.ts:18)

- Lenses: duplication, idioms
- Risk: medium
- Proposed fix: Sites: `'(no description)'` at src/vanilla/cheatsheet.ts:18 and src/react/ShortcutCheatsheet.tsx:141,158; `'Keyboard shortcuts'` at src/vanilla/cheatsheet.ts:53, src/vanilla/popup.ts:57, src/react/WhichKeyPopup.tsx:48,81, src/react/ShortcutCheatsheet.tsx:133; `'Press Escape to close.'` at src/vanilla/cheatsheet.ts:88 and src/react/ShortcutCheatsheet.tsx:165. The `wk-*` class contract has a parity test (src/**tests**/class-contract.test.tsx); this parallel string contract has none, so the renderers can drift silently. Add a module-private `src/shared/strings.ts` (not re-exported) with `NO_DESCRIPTION`, `SHORTCUTS_LABEL` and `CHEATSHEET_HINT`. **Caveat 1:** leave registry.ts:79-80's `'(no description)'` alone — that one is warning text, a different contract. **Caveat 2:** the related `candidateLabel` half — src/vanilla/popup.ts:23 (`${c.isGroup ? '+' : ''}${c.description ?? c.keys}`) vs src/react/WhichKeyPopup.tsx:28-29 (the same expression as two adjacent JSX children) — is genuinely shared model logic and could move to the same module as `candidateLabel(c: WhichKeyCandidate): string`, but React currently emits `'+'` and the description as two adjacent text nodes, so collapsing them to one string changes SSR markup (React drops the `<!-- -->` separator) even though `textContent` is unchanged. Check src/react/**tests**/ssr.test.tsx and src/**tests**/class-contract.test.tsx before applying that half, or apply only the constants.
- [x] execute [ ] skip

### T34. Shared preamble followed by two large inline layout branches: `renderPopup` (src/vanilla/popup.ts:40-84, 45 lines)

- Lenses: long-methods
- Risk: medium
- Proposed fix: Extract the two branch bodies into module-private builders alongside the existing `kbd`/`row`/`sequence` helpers: `const horizontalBody = (p: string, snap: WhichKeySnapshot, maxRows: number): HTMLElement` (lines 59-68) and `const verticalBody = (p: string, snap: WhichKeySnapshot): DocumentFragment` (70-81). `renderPopup` becomes the visibility guard, the shared attribute block, and a one-line ternary append. `renderPopup` is not re-exported from src/vanilla/index.ts, so nothing public moves. If T23 lands first, write the new builders against `el()`.
- [x] execute [ ] skip

### T35. `CLAUDE.md` misdescribes the deferred-fire event as synthetic (CLAUDE.md:42)

- Lenses: comments
- Risk: low
- Proposed fix: CLAUDE.md's "Runtime flow" section says the leaf-AND-prefix branch fires "the leaf with a _synthetic_ `KeyboardEvent`". The code deliberately does the opposite: `src/engine/matcher.ts:149` is `const fireEvent = event;`, carrying a comment that explains a never-dispatched synthetic event would have `target === null`, would not be cancelable, and would report all modifier flags false. Reword line 42 to say the original `keydown` is retained and reused, and note why. Found by the doc-comment fixer while documenting `MatcherOptions.onFire`; CLAUDE.md is outside the lens scan scope (markdown), so it was not caught in triage.
- [x] execute [ ] skip

## Skip (do not re-flag in future runs)
