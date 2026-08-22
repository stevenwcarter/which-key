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

## Low severity

### T30. Group labels have no `global` escape hatch from an exclusive layer: `getActiveGroup` (src/engine/registry.ts:133)

- Lenses: opportunistic
- Risk: high — needs characterization tests first
- Proposed fix: decision-needed: `GroupEntry` has no `global` field, so `getActiveGroup` blocks a group label at `level < blockLevel()` even when the shortcuts under that prefix remain reachable via `global: true` — an exclusive layer can therefore leave a still-firing shortcut with its prefix label missing from the popup and cheatsheet. Closing the asymmetry means adding `global` to the public `GroupEntry`/group-registration options and deciding whether group labels _should_ follow their shortcuts through a layer block; that is a semantics + public-API call, not a mechanical tidy. Note T15 extracts the shared winner cascade across `findActive`/`getActiveGroup` and must deliberately preserve this asymmetry until it is decided.
- [ ] execute [ ] skip

## Skip (do not re-flag in future runs)
