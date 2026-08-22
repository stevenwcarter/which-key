# Coverage + Codecov + 80% Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm test` report code coverage and fail below an 80% global threshold on all four metrics, upload coverage to Codecov from a Node-24-only CI job, and confirm the suite already exceeds 80%.

**Architecture:** Add a `coverage` block (v8 provider, `all: true` over `src/**`, with excludes) plus global 80% thresholds to `vitest.config.ts`; point the `test` script at `vitest run --coverage` so the gate runs everywhere `npm test` runs. CI drops its Node matrix to a single Node 24 job and adds a `codecov/codecov-action@v5` upload of `coverage/lcov.info`.

**Tech Stack:** Vitest 2.1.x, `@vitest/coverage-v8`, GitHub Actions, Codecov.

## Global Constraints

- Coverage provider: **v8** (`@vitest/coverage-v8`, matching Vitest `^2.1.8`).
- Gated metrics: **lines, statements, functions, branches**, all at **80%**, **global** scope.
- Coverage denominator: `all: true`, `include: ['src/**']`.
- Excludes: `**/__tests__/**`, `**/*.test.{ts,tsx}`, `src/test-setup.ts`, `**/*.config.*`, `examples/**`, `dist/**`, `**/*.d.ts`, `src/engine/types.ts`, `src/*/index.ts` (re-export barrels).
- Reporters: `['text', 'lcov', 'html']`. The `lcov` reporter MUST stay — CI uploads `./coverage/lcov.info`.
- CI runs on **Node 24 only**. Codecov upload uses `fail_ci_if_error: false` and `token: ${{ secrets.CODECOV_TOKEN }}` (secret added by maintainer, out of scope).
- Named exports only; TypeScript strict; do not touch `package.json` `engines`.

---

### Task 1: Coverage config, test script, and gitignore

**Files:**

- Modify: `vitest.config.ts`
- Modify: `package.json` (the `test` script; ensure `@vitest/coverage-v8` devDep)
- Modify: `.gitignore`

**Interfaces:**

- Consumes: nothing (first task).
- Produces: a `coverage/lcov.info` file on every `npm test` run (Task 2's CI upload depends on this exact path); a passing 80%-gated `npm test`.

- [ ] **Step 1: Confirm the coverage package is installed**

Run: `node -e "require('@vitest/coverage-v8/package.json')" && echo OK`
Expected: `OK`. If it errors, run `npm install -D @vitest/coverage-v8@^2.1.8`.
Also confirm `package.json` `devDependencies` lists `"@vitest/coverage-v8": "^2.1.8"`.

- [ ] **Step 2: Add the coverage block to `vitest.config.ts`**

Replace the file contents with:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**'],
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        'src/test-setup.ts',
        '**/*.config.*',
        'examples/**',
        'dist/**',
        '**/*.d.ts',
        'src/engine/types.ts',
        'src/engine/index.ts',
        'src/react/index.ts',
        'src/vanilla/index.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
```

- [ ] **Step 3: Point the `test` script at coverage**

In `package.json`, change the `test` script from `"vitest run"` to:

```json
"test": "vitest run --coverage",
```

Leave `test:watch` as `"vitest"`.

- [ ] **Step 4: Ignore the coverage output directory**

Append to `.gitignore` (only if `coverage` is not already present):

```
coverage/
```

- [ ] **Step 5: Run the gated suite and capture the table**

Run: `npm test`
Expected: all 169 tests pass; a coverage table prints; the run exits **0** (no `ERROR: Coverage for X does not meet global threshold` lines). Record the four global percentages from the `All files` row.

If any gated metric is **below 80%**: add focused tests for the weakest real module (likely candidates: `src/react/useWhichKeyState.ts` branch paths, `src/vanilla/cheatsheet.ts` truncation path at lines ~50-66) following TDD (write failing test → run → it passes against existing code since this is characterization → commit), then re-run `npm test` until every metric ≥ 80%. Based on the baseline (~95/91/90/95 on `src/`), no new tests are expected to be required.

- [ ] **Step 6: Verify the lcov file exists**

Run: `test -f coverage/lcov.info && echo "lcov OK"`
Expected: `lcov OK` (this is the file CI will upload in Task 2).

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json package-lock.json .gitignore
git commit -m "test(which-key): enable v8 coverage with 80% global gate; npm test now reports coverage"
```

---

### Task 2: CI single Node 24 job + Codecov upload + codecov.yml

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `codecov.yml`

**Interfaces:**

- Consumes: `coverage/lcov.info` produced by `npm test` (Task 1).
- Produces: a CI workflow that gates coverage and uploads to Codecov.

- [ ] **Step 1: Rewrite `.github/workflows/ci.yml` for a single Node 24 job with Codecov upload**

Replace the file contents with:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request: {}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: false
      - run: npm run build
      - run: npm pack --dry-run
```

- [ ] **Step 2: Create `codecov.yml`**

```yaml
coverage:
  status:
    project:
      default:
        target: 80%
    patch:
      default:
        target: 80%
```

- [ ] **Step 3: Validate the workflow YAML parses**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!/node-version:\s*24/.test(y)) throw new Error('node 24 missing'); if(/matrix/.test(y)) throw new Error('matrix still present'); if(!/codecov\/codecov-action@v5/.test(y)) throw new Error('codecov step missing'); console.log('ci.yml OK')"`
Expected: `ci.yml OK`

- [ ] **Step 4: Validate `codecov.yml` parses and targets 80%**

Run: `node -e "const y=require('fs').readFileSync('codecov.yml','utf8'); if(!/target:\s*80%/.test(y)) throw new Error('80% target missing'); console.log('codecov.yml OK')"`
Expected: `codecov.yml OK`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml codecov.yml
git commit -m "ci(which-key): single Node 24 job, upload coverage to Codecov, 80% status targets"
```

---

### Task 3: Documentation updates

**Files:**

- Modify: `README.md` (add Codecov badge + a short Coverage note)
- Modify: `CLAUDE.local.md` (commands table: `npm test` now runs coverage)

**Interfaces:**

- Consumes: behavior from Tasks 1-2 (gated `npm test`, Codecov upload).
- Produces: docs consistent with the new behavior.

- [ ] **Step 1: Add a Codecov badge to `README.md`**

Locate the existing badge row / title area at the top of `README.md`. Add a Codecov badge alongside any existing badges (or immediately under the `# which-key` title if there is no badge row):

```markdown
[![codecov](https://codecov.io/gh/stevenwcarter/which-key/branch/main/graph/badge.svg)](https://codecov.io/gh/stevenwcarter/which-key)
```

- [ ] **Step 2: Add a Coverage note to `README.md`**

Add a short subsection near the Contributing section:

```markdown
## Coverage

The test suite is gated at **80%** (lines, statements, functions, branches). `npm test` runs Vitest with V8 coverage and prints a report; CI uploads results to Codecov.
```

- [ ] **Step 3: Update the commands table in `CLAUDE.local.md`**

Change the `npm test` row from:

```
| `npm test` | Run the full Vitest suite once |
```

to:

```
| `npm test` | Run the full Vitest suite once, with V8 coverage; fails under the 80% global gate |
```

- [ ] **Step 4: Verify docs reference the gate and don't contradict the config**

Run: `grep -n "80%" README.md CLAUDE.local.md && grep -n "codecov" README.md`
Expected: matches in both files for `80%`, and a codecov badge line in `README.md`.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.local.md
git commit -m "docs(which-key): document 80% coverage gate and Codecov upload"
```

---

## Final verification (after all tasks)

- [ ] Run the full pre-push gate: `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] Confirm `npm test` exits 0 with all four global metrics ≥ 80%; record the numbers.
- [ ] Confirm `coverage/lcov.info` exists and `coverage/` is gitignored (not staged).

## Self-review notes

- **Spec coverage:** dependency (T1 S1), vitest coverage block (T1 S2), test script (T1 S3), gitignore (T1 S4), CI single Node 24 + Codecov (T2), codecov.yml (T2 S2), README + CLAUDE.local.md docs (T3), verification (final section). All spec sections mapped.
- **Invariant pinned:** the spec's load-bearing invariant — `npm test` emits `coverage/lcov.info` that CI consumes — is verified explicitly in T1 S6 and re-asserted by T2's `files: ./coverage/lcov.info`.
- **No placeholders; exact paths and commands throughout.**
