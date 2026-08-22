# Release Tooling (Conventional Commits) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conventional-commits release workflow (changelog + semver bump + tag + publish instructions) to `package.json`, enforce commit format with commitlint/husky, and retire the Changesets scaffolding.

**Architecture:** `commit-and-tag-version` runs locally to derive the next version from commit messages, regenerate `CHANGELOG.md`, commit, and tag — stopping before push/publish. A husky `commit-msg` hook runs commitlint to keep messages parseable. Changesets config and intent files are removed.

**Tech Stack:** Node 24 / npm 11, `commit-and-tag-version`, `husky` (v9), `@commitlint/cli`, `@commitlint/config-conventional`. Repo is `"type": "module"`.

## Global Constraints

- Repo is `"type": "module"` → root config JS files use ESM (`export default`).
- `npm run lint` is `eslint .` (lints repo root) → any new root `.js` config must pass lint or be ignored. `tsconfig` includes only `src` (config files not typechecked).
- The release script MUST NOT auto-push or auto-publish — it only prepares (version/changelog/tag) and prints manual publish instructions.
- `release:dry` MUST be side-effect-free (no commit, tag, or file change).
- Do NOT create/push a real `v0.2.0` tag or release commit as part of this branch — tooling only; verify via `--dry-run`.
- Keep the existing gate green: `npm run lint && npm run typecheck && npm test && npm run build`.
- `CLAUDE.local.md` stays ≤ 500 lines AND ≤ 20000 chars.

---

### Task 1: Release script (`commit-and-tag-version`)

**Files:**

- Modify: `package.json` (devDependencies + scripts)

**Interfaces:**

- Produces: npm scripts `release`, `release:dry`, `postrelease`. `release` = `commit-and-tag-version` (bump+changelog+commit+tag, no push/publish). `postrelease` prints publish steps and runs automatically after `npm run release`.

- [ ] **Step 1: Install the release engine**

Run: `npm install --save-dev commit-and-tag-version`
Expected: adds `commit-and-tag-version` to `devDependencies`; `package-lock.json` updated.

- [ ] **Step 2: Add the scripts to `package.json`**

In the `"scripts"` block, add these three entries (keep existing scripts):

```json
    "release": "commit-and-tag-version",
    "release:dry": "commit-and-tag-version --dry-run",
    "postrelease": "echo 'Release prepared. To publish:' && echo '  git push --follow-tags origin main' && echo '  npm publish'"
```

Rationale: npm automatically runs `postrelease` after `release` (post-hook for any script name); `release:dry` is a distinct name so it does not trigger the post-hook. The `postrelease` body only echoes — it must not contain `git push` or `npm publish` as executed commands.

- [ ] **Step 3: Verify the dry run behaves correctly and changes nothing**

The tool applies 0.x semver: at `0.x` with no prior tag, `feat:` commits bump **patch**, so
the default dry run reports `0.1.0 → 0.1.1`. **This is the correct expected output** (the
first release to `0.2.0` is a separate one-time forced minor, documented in Task 3 — NOT
this script's default).

Run: `npm run release:dry`
Expected: output shows bump from `0.1.0` to **`0.1.1`** with a "Features" changelog preview.

Confirm the planned first release previews 0.2.0 (still no side effects):
Run: `npm run release -- --dry-run --release-as minor`
Expected: shows `0.1.0` to **`0.2.0`**.

Then verify no side effects from either dry run:
Run: `git status --porcelain && git tag -l`
Expected: working tree clean apart from `package.json`/`package-lock.json` from Step 1 (no new commit), and `git tag -l` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(which-key): add commit-and-tag-version release scripts"
```

---

### Task 2: Commit-message enforcement (commitlint + husky)

**Files:**

- Create: `commitlint.config.js`
- Create: `.husky/commit-msg`
- Modify: `package.json` (devDependencies + `prepare` script)
- Possibly modify: the eslint config (only if `eslint .` flags `commitlint.config.js`)

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: a `commit-msg` git hook that rejects non-conventional commit messages; `prepare` script installs husky on `npm install`.

- [ ] **Step 1: Install commitlint + husky**

Run: `npm install --save-dev husky @commitlint/cli @commitlint/config-conventional`
Expected: three packages added to `devDependencies`.

- [ ] **Step 2: Create `commitlint.config.js`** (ESM, repo is `"type": "module"`):

```js
export default {
  extends: ['@commitlint/config-conventional'],
};
```

- [ ] **Step 3: Initialize husky and add the `prepare` script**

Run: `npx husky init`
Expected: creates `.husky/` (with a sample `.husky/pre-commit`), the generated `.husky/_/` directory, and adds `"prepare": "husky"` to `package.json` scripts. (If `npx husky init` does not add `prepare`, add `"prepare": "husky"` to `package.json` manually.)

Then remove the sample hook we don't want:
Run: `rm -f .husky/pre-commit`

- [ ] **Step 4: Create the `commit-msg` hook** at `.husky/commit-msg` with exactly:

```sh
npx --no -- commitlint --edit "$1"
```

Make it executable:
Run: `chmod +x .husky/commit-msg`

- [ ] **Step 5: Verify commitlint accepts good and rejects bad messages**

Run: `echo "feat: add a thing" | npx commitlint`
Expected: exit code 0 (no output / success).

Run: `echo "nonsense message" | npx commitlint; echo "exit=$?"`
Expected: non-zero exit (reports "type may not be empty" / "subject may not be empty").

- [ ] **Step 6: Verify the hook actually fires (without leaving a stray commit)**

Run:

```bash
git commit --allow-empty -m "broken commit message" || echo "HOOK_BLOCKED_OK"
```

Expected: the commit is rejected by the `commit-msg` hook and `HOOK_BLOCKED_OK` prints (no commit created). Confirm with `git log -1 --oneline` that HEAD is still the Task 1 commit. If a commit slipped through, `git reset --hard HEAD~1` and fix the hook wiring.

- [ ] **Step 7: Confirm lint is still clean with the new config file**

Run: `npm run lint`
Expected: 0 errors. If `eslint .` errors on `commitlint.config.js`, locate the eslint config (`eslint.config.*` flat config or `.eslintrc.*`) and add `commitlint.config.js` to its ignore list (flat config: add to the top-level `ignores` array; legacy: `.eslintignore`). Re-run until clean. Do NOT disable rules globally.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json commitlint.config.js .husky
git commit -m "build(which-key): enforce conventional commits via commitlint + husky"
```

(Note: husky's generated `.husky/_/` contains its own `.gitignore`; `git add .husky` will stage only the tracked hook files. Verify with `git status` that `.husky/commit-msg` is staged and `.husky/_/` internals are not.)

---

### Task 3: Retire Changesets + documentation

**Files:**

- Delete: `.changeset/config.json`, `.changeset/initial.md`, `.changeset/keybinding-layers.md` (and the empty `.changeset/` dir)
- Modify: `README.md` (new "Releasing" section)
- Modify: `CLAUDE.local.md` (remove `npx changeset`; add release/commit guidance; update commands table)

**Interfaces:**

- Consumes: the scripts from Tasks 1–2 (`release`, `release:dry`, the commit-msg hook).

- [ ] **Step 1: Remove the Changesets scaffolding**

Run: `git rm -r .changeset`
Expected: removes the three files. (Their `minor` intent is already represented by the `feat:` commits the changelog reads.)

- [ ] **Step 2: Add a "Releasing" section to `README.md`**

Read `README.md` first to match heading style; add near the end (after contributing/dev sections) a section like:

````markdown
## Releasing

Versioning is driven by [Conventional Commits](https://www.conventionalcommits.org/).
The version bump and changelog are derived from commit messages since the last tag.
While the package is pre-1.0 (`0.x`), semver-for-0.x rules apply:

- `fix: …` → patch (e.g. `0.2.0` → `0.2.1`)
- `feat: …` → **patch** while `0.x` (the public API is still unstable)
- `feat!: …` or a `BREAKING CHANGE:` footer → **minor** while `0.x` (`0.2.0` → `0.3.0`)

(After the project cuts `1.0.0`, the usual rules resume: `feat:`→minor, `feat!:`→major.)

Commit messages are linted by a husky `commit-msg` hook (`@commitlint/config-conventional`).

**First release (one-time):** the default first bump with no prior tag would be a patch
(`0.1.1`); to start at `0.2.0` instead, force a minor once:

```bash
npm run release -- --release-as minor   # 0.1.0 → 0.2.0, writes CHANGELOG.md, tags v0.2.0
```

**Ongoing releases:**

```bash
npm run release:dry   # preview the next version + changelog (no changes)
npm run release       # bump package.json, regenerate CHANGELOG.md, commit, and tag
```

`npm run release` does not push or publish. After it succeeds, publish manually:

```bash
git push --follow-tags origin main
npm publish           # prepublishOnly rebuilds dist/ first
```

To intentionally cut `1.0.0`: `npm run release -- --release-as major`.
````

- [ ] **Step 3: Update `CLAUDE.local.md`**

Read the file. Make these edits:

- In the commands table, add rows:
  - `npm run release:dry` — Preview the next version + changelog (conventional commits; no changes)
  - `npm run release` — Bump version from commits, write `CHANGELOG.md`, commit, tag
- Replace the sentence telling contributors to run `npx changeset` (currently: "Behavior-changing PRs need a changeset (`npx changeset`; `patch`/`minor`/`major`). Docs-only PRs may skip it.") with:
  > Commits follow Conventional Commits, enforced by a husky `commit-msg` hook (`@commitlint/config-conventional`). Versioning uses `commit-and-tag-version` with semver-for-0.x rules while pre-1.0: `fix:`→patch, `feat:`→patch, `feat!:`/`BREAKING CHANGE:`→minor (after `1.0.0`: `feat:`→minor, `feat!:`→major). Cut a release with `npm run release` (preview: `npm run release:dry`) — it derives the version + `CHANGELOG.md` + tag from commit messages. The first release to `0.2.0` is a one-time `npm run release -- --release-as minor`. Publish per the README "Releasing" section.
- If the file mentions a changeset in the CI description, leave CI text accurate (CI does not run changesets; do not invent CI changes here).

- [ ] **Step 4: Verify CLAUDE.local.md budget**

Run: `wc -l -c CLAUDE.local.md`
Expected: ≤ 500 lines AND ≤ 20000 characters (currently ~49 lines / ~5.5 KB, so fine).

- [ ] **Step 5: Confirm the full gate is green**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all pass (no `.changeset`/docs change affects these; lint clean per Task 2 Step 7).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(which-key): document conventional-commits releases; remove Changesets"
```

---

### Task 4: Full gate + final review + finish branch

- [ ] **Step 1: Re-run the full pre-push gate**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: all green.

- [ ] **Step 2: Re-verify the release invariants end-to-end**

Run: `npm run release:dry && git status --porcelain && git tag -l`
Expected: dry run shows `0.2.0`; working tree clean; no tags. (Pins invariant 2: dry run is side-effect-free.)

Confirm the `release`/`postrelease` script bodies contain no executed `git push` or `npm publish` (only echoes). (Pins invariant 1.)

- [ ] **Step 3:** Dispatch the final code-reviewer subagent over the branch diff; address Critical/Important findings via the receiving-code-review flow until clean.

- [ ] **Step 4:** Invoke `superpowers:finishing-a-development-branch`.

## Self-Review notes

- **Spec coverage:** release scripts + first-release 0.2.0 → Task 1; commitlint+husky enforcement → Task 2; remove `.changeset/` + README "Releasing" + CLAUDE.local.md migration + budget → Task 3; gate + final review + finish → Task 4. All three "Invariants this feature depends on" are pinned: (1) no auto-publish/push — Task 1 Step 2 + Task 4 Step 2; (2) dry-run side-effect-free — Task 1 Step 3 + Task 4 Step 2; (3) commitlint actually blocks — Task 2 Steps 5–6.
- **No placeholders:** every step has exact commands/code.
- **Consistency:** script names `release`/`release:dry`/`postrelease` and the `prepare`/husky `commit-msg` wiring are referenced identically across tasks and docs.
- **Note on TDD:** this deliverable is configuration, not application logic, so "tests" are the dry-run/commitlint/gate verifications rather than `*.test.ts` files — consistent with the spec's testing section.
