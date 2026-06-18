# Release Tooling (Conventional Commits) — Design

**Date:** 2026-06-17
**Status:** Approved (brainstorming → spec)
**Branch:** `feat/release-tooling`

## Problem

`package.json` has no release/version workflow. The repo is half-scaffolded for
**Changesets** (`.changeset/config.json` + two intent files) but `@changesets/cli`
isn't even installed, and `CLAUDE.local.md` tells contributors to run `npx changeset`.
We want a **conventional-commits**-driven release instead: a script that derives the
next semver version from commit messages, regenerates `CHANGELOG.md`, commits, tags,
and then tells the maintainer how to publish. The two commit history already uses
conventional prefixes (`feat:`/`fix:`/`docs:`/`test:`/`ci:`/`chore:`).

These two paradigms compete for ownership of the version-bump decision, so we adopt
conventional commits and **remove** the Changesets scaffolding.

## Decisions (locked in brainstorming)

1. **Model:** conventional commits, not Changesets. Remove `.changeset/`.
2. **First release:** bump now from history → `0.1.0` becomes **`0.2.0`**, tag `v0.2.0`
   (we have `feat:` commits and no prior tag, so the highest bump is `minor`).
3. **Enforcement:** add commitlint + a husky `commit-msg` hook to reject malformed
   messages locally.
4. **Tool:** `commit-and-tag-version` (local/manual; the maintained successor to the
   deprecated `standard-version`). It stops before push/publish so the maintainer
   controls timing. (`semantic-release`/`release-please` rejected — CI-driven, auto-publish.)

## Components

### Dev dependencies (add)
- `commit-and-tag-version` — the release engine (changelog + version + tag).
- `husky` — git hooks (v9+ API: `husky` init, no `husky install`).
- `@commitlint/cli` + `@commitlint/config-conventional` — commit-message linting.

Install latest stable of each; pin with caret ranges to match existing devDeps style.

### `package.json` scripts
- `"release": "commit-and-tag-version"` — bump version from commits since last tag,
  regenerate `CHANGELOG.md`, create a `chore(release): x.y.z` commit, create tag
  `vX.Y.Z`. Does **not** push or publish.
- `"release:dry": "commit-and-tag-version --dry-run"` — preview only; changes nothing,
  creates no commit/tag.
- `"postrelease"` — printed publish instructions. npm runs this automatically **after**
  `npm run release` (it is the npm post-hook for the `release` script). It echoes:
  - `git push --follow-tags origin main`
  - `npm publish`
  It must NOT itself push or publish (executing-actions-with-care: maintainer does that).
  `release:dry` is a distinct script name, so `postrelease` does not fire for dry runs.
- `"prepare": "husky"` — installs husky hooks on `npm install`.
- Existing `"prepublishOnly": "npm run build"` is kept (so `npm publish` rebuilds first).

### Config files
- `commitlint.config.js` — the repo is `"type": "module"`, so use **ESM**:
  `export default { extends: ['@commitlint/config-conventional'] };`.
  `eslint .` lints the repo root, so this file (and any other new root config) must pass
  lint or be added to the eslint ignore set; `tsconfig` only includes `src`, so it is not
  typechecked.
- `.husky/commit-msg` — runs `npx --no -- commitlint --edit "$1"`. Husky v9 hook files
  are plain scripts (no sourcing of `husky.sh`).
- `.versionrc.json` — optional, only if defaults need adjusting. Default sections
  (Features, Bug Fixes) are acceptable; **prefer defaults (YAGNI)** unless a concrete
  need arises. If added, document why.

### Removals
- Delete `.changeset/config.json`, `.changeset/initial.md`, `.changeset/keybinding-layers.md`,
  and the now-empty `.changeset/` directory. Their `minor` intent is already represented
  by the `feat:` commits the changelog will read.

### Documentation
- **README** — new "Releasing" section: the conventional-commit format (feat/fix/feat!/
  BREAKING CHANGE → minor/patch/major), `npm run release:dry` to preview, `npm run release`
  to cut a release, then the printed publish steps (`git push --follow-tags`, `npm publish`).
- **`CLAUDE.local.md`** — remove the `npx changeset` instruction; replace with: "Commits
  follow Conventional Commits (enforced by a commitlint `commit-msg` hook). Cut a release
  with `npm run release` (preview: `npm run release:dry`); it bumps the version from
  commit messages, writes `CHANGELOG.md`, and tags. Publish per the README Releasing
  section." Update the commands table to add `release` / `release:dry`. Keep within the
  500-line / 20 KB budget (currently ~49 lines).

## First-release behaviour (explicit)

Run `npm run release` once on this branch's merge result (or document it as the maintainer's
first action). With no prior tag, `commit-and-tag-version` scans all history; the highest
conventional bump is `minor` (from `feat:` commits, no breaking changes), so `0.1.0 → 0.2.0`.
It writes `CHANGELOG.md` (Features/Bug Fixes grouped from history), commits
`chore(release): 0.2.0`, and tags `v0.2.0`.

**Note:** the actual version bump/tag is a release action the maintainer performs; this
spec's deliverable is the *tooling and scripts*, verified via `--dry-run`. Do not create
the real `v0.2.0` tag as part of implementing/merging this branch unless the maintainer
asks — cutting a real release is a separate, deliberate step.

## Testing / verification (tooling, not unit-testable logic)

There is no application logic to unit-test; the deliverable is configuration. Acceptance
checks (run during implementation; record output):
1. `npm install` (or `npm ci`) succeeds with the four new dev deps; `prepare` runs husky.
2. `npm run release:dry` prints the computed next version **`0.2.0`** and a changelog
   preview, and creates **no** commit, tag, or file change (verify `git status` clean and
   no new tag afterward).
3. commitlint rejects a bad message and accepts a good one:
   - `echo "nonsense message" | npx commitlint` → exits non-zero.
   - `echo "feat: add a thing" | npx commitlint` → exits zero.
4. `.husky/commit-msg` exists and is wired (a test commit with a bad message is rejected;
   confirm without leaving a stray commit — use a throwaway/`--dry-run`-style check or
   reset).
5. Existing gate unaffected: `npm run lint && npm run typecheck && npm test && npm run build`
   still green (the new config files must not break lint/typecheck — adjust eslint/tsconfig
   ignores if `commitlint.config.js` is picked up by lint).

## Invariants this feature depends on

1. **The release script must not auto-publish or auto-push.** Pin by asserting `release`
   and `postrelease` contain no `npm publish` / `git push` execution (only the echoed
   instructions). A future edit that "automates" publishing must consciously change this.
2. **`release:dry` is side-effect-free.** Pin by checking `git status` is clean and no tag
   was created after running it.
3. **commitlint actually blocks bad commits** (not just installed). Pin with the
   accept/reject check above — installing commitlint without wiring the hook is a silent
   no-op.

## Acceptance criteria

- All five verification checks pass; the three invariants are demonstrated.
- `.changeset/` removed; `CLAUDE.local.md` no longer references `npx changeset`.
- README "Releasing" section added; `CLAUDE.local.md` updated and within budget.
- `lint`, `typecheck`, `test`, `build` remain green.
- No real `v0.2.0` tag/commit is pushed as part of this branch (tooling only).
