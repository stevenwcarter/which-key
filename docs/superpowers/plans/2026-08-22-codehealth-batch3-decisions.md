# code-health batch 3 — decisions record

Companion to `2026-08-22-codehealth-batch3.md` (the plan) and
`../specs/2026-08-22-codehealth-batch3-design.md` (the spec).

The execution ledger lived in a git-ignored scratch directory. These are the
calls made on the maintainer's behalf, and the observations parked rather than
acted on — preserved so they outlive the workspace.

Branch: `codehealth/2026-08-22-batch3`, stacked on `codehealth/2026-08-21-batch2`
(PR #2). 7 items across 18 commits; 313 → 381 tests.

Two of the seven were `decision-needed` markers the maintainer resolved with
written direction: the cheatsheet re-render (→ a registry `version` counter) and
the dark-only theme (→ `prefers-color-scheme` with a `data-wk-theme` override).

## Rulings (8)

Each is a decision taken without asking, with what it costs if wrong.

- Ruling 1 (Task 4, B15) — pre-emptive. B15 adds a `console.warn` to `parseKey`, which sits on the registration path every other test uses. A test elsewhere that registers a multi-character non-special key would newly warn, breaking any `expect(warn).not.toHaveBeenCalled()` assertion. DECIDED: T4's brief already requires running the full engine and React suites (Step 6) rather than just keys.test.ts, and instructs the implementer to STOP and report if a pre-existing test fails rather than adjusting it. If such a failure appears, it is a signal the alias table over-warns — not a test to edit. Cost if wrong: a fix round on T4.

- Ruling 2 (branch topology) — the seven items build directly on batch 2 (B45 reuses B34's shape, B47 completes B23's convention, B44 closes a gap B21 opened, B46 finishes B16/B28's sweep), so they cannot branch from main. PR #2 is open with 51 commits under review, and pushing seven more findings into it mid-review would be disruptive. DECIDED: stack a new branch on batch 2 and let the maintainer choose at the end whether to merge separately or fold in. Cost if wrong: one extra PR to sequence.

- Ruling 3 (Task 7, D2) — the light palette is written out twice (once under `prefers-color-scheme: light`, once under `[data-wk-theme='light']`) rather than shared. Plain CSS cannot reference one property block from two selectors, and the alternative — `light-dark()` with `color-scheme` — would silently raise the library's browser floor to Chrome 123 / Safari 17.5 / Firefox 120. The package declares no browserslist, no `engines` beyond Node, and no support policy, so raising the floor is the maintainer's deliberate call, not a side effect of a theming task. DECIDED: duplicate explicitly, and instruct the implementer not to substitute `light-dark()` but to raise it as a follow-up finding if it bothers them. Cost if wrong: 13 duplicated declarations that must be kept in sync; a future `light-dark()` migration is a clean one-file change.

- Task 2: Ruling 4 — the review found the docs row dropped the trailing ". Falling back to 0." and labelled it plan-mandated. UPHELD against my own brief: my Step 6 specified that truncated text, so the implementer copied it faithfully — the error was mine. The batch's constraints make the table verbatim, and the clause that got dropped is the fallback, which is the whole point of the soft-fail contract; a reader would have learned their level was rejected but not that it silently became 0. Cost if wrong: none, the row is now longer and more accurate.

- Ruling 5 — the failure is a defect in tooling I added earlier this session (the /ship-it format:check + pre-commit work), not in batch 3. `.superpowers/` is excluded via .git/info/exclude, which Prettier does NOT read — it reads only .gitignore and .prettierignore. So `npm run format:check` reports every SDD scratch file and can never be green while a workspace exists. It passed at the end of batch 2 only because that workspace had already been deleted, which is why this surfaced now rather than then. This blocks THIS batch's own global constraint (format:check green before every commit), so it had to be resolved rather than deferred. DECIDED: add a .prettierignore listing .superpowers/ (plus dist/ and coverage/ for completeness), as controller bookkeeping rather than a dispatched task — it is two lines, unambiguous, belongs to none of the seven items, and blocks all of them. Verified it does not over-exclude by planting a deliberate formatting error in src/engine/keys.ts and confirming format:check still reports it. Cost if wrong: a path that should be formatted is skipped; the over-exclusion check rules that out for source.

- Task 4: Ruling 6 — the shipped test was named "...bindable and silent" while parseKey('MediaPlayPause') actually warns; it passed only because it never asserted silence. Labeled plan-mandated because my brief demanded a warning for every unrecognised base AND named the test "silent" — a contradiction the implementer inherited and flagged in prose but left in the artifact. UPHELD: a false test name is worse than no test, since a future reader will believe exotic keys are handled silently and misdiagnose accordingly. Resolved by renaming and pinning the warning, NOT by changing behaviour — warning for an unrecognised base is correct, because the library genuinely cannot distinguish a real-but-unlisted event.key from a typo, and the message is hedged for exactly that reason. Cost if wrong: consumers binding exotic keys see one hedged warning per registration.

- Task 7: Ruling 7 — the docs claimed data-wk-theme works "on <html> (or any ancestor)" but the selectors are :root-scoped, which matches only the document root; the reviewer proved the override silently no-ops on a wrapping div in real Chromium. Wording inherited from my brief. UPHELD, and DECIDED to fix the DOCS rather than loosen the selector: a bare [data-wk-theme=...] would make per-subtree theming work in React but silently fail in vanilla, whose popup host is appended to document.body rather than nested under the consumer's markup — precisely the renderer divergence this codebase has spent two batches eliminating. An honest constraint identical in both renderers beats a feature that half-works in one. Cost if wrong: consumers cannot theme a subtree; they can still theme the document and override individual --wk-\* properties anywhere.

- Ruling 8 — MY RULING 1 PRODUCED A BAD OUTCOME, and I am recording that plainly. Ruling 1 pre-empted the risk that B15's new warning would break existing tests, and set the discharge criterion as "grep the repo for call sites that would newly warn". That grep came back clean and I treated the risk as discharged. It was structurally incapable of finding this: nothing in this repo binds Delete (verified — zero hits across src/, examples/, README.md, docs/API.md). The criterion tested the repo's own usage, not the consumer surface, and B15 is a change to a PUBLIC canonicalizer. The right criterion would have been "enumerate the real event.key values a consumer might plausibly bind and check each". Cost of the miss: caught here rather than by a user, at the price of one fix wave.

## Deferred observations (8)

Raised in review, judged not worth acting on. Recorded so a future pass can
re-judge rather than rediscover them.

- Task 2: minor (deferred): the first report's test arithmetic said "313 + 10" where the true decomposition is "316 + 7"; two errors cancelled to the correct total. Corrected in the amended report.
- Task 3: minor (deferred): two adjacent comments both open "Mirror the prefix-only branch" — cosmetic, and it is my brief's prescribed text.
- Task 4: minor (deferred): the first report's summary said "all 21 new tests are load-bearing" when 3 are pins; the detailed narrative was accurate. Corrected in the amended report.
- Task 5: minor (deferred): that suppression's rationale sits in a separate comment block above the directive, while the file's other two suppressions carry their reason inline after `--`. A `grep -n eslint-disable` audit surfaces a bare directive for this one and a self-contained reason for the others. No natural home in Tasks 6-7 (neither touches this file), so leaving for the final review to triage.
- Task 6: minor (deferred): isInputTarget's entry says it "backs the enableOnInputs option", which is true but partial — matcher.ts also uses it for the input-echo latch. Low stakes for a symbol explicitly framed as internal.
- Task 6: minor (deferred): SortMode's union is written in a different member order than the options table above it and than types.ts. Semantically identical.
- Task 6: minor (deferred): the report's summary table labels the Matcher row "excluded, unchanged" though its occurrence count moved 0->1 via a new incidental prose mention. Defensible reading, slightly overstated.
- Task 7: minor (deferred, FOR FINAL REVIEW): README.md:279's phrase "the document root, not just any ancestor" is locally ambiguous — "not just X" idiomatically reads as "more than X", the opposite of the intent. Disambiguated by the very next sentence, so not misleading in context. Proposed replacement: "specifically the document root; an ancestor further down the tree will not work." The styles.css and docs/API.md phrasings avoid the construction and are unambiguous.
