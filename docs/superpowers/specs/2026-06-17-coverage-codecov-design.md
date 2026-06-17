# Coverage reporting + Codecov + 80% gate

**Date:** 2026-06-17
**Status:** Approved (via `/ship-it --ask`)

## Goal

Replace the plain Vitest test run with a coverage-enabled run that:

1. Reports code coverage (console + machine-readable + browsable HTML).
2. Enforces an 80% global threshold on all four metrics (lines, statements, functions, branches), failing the run when any metric dips below.
3. Uploads coverage to Codecov from CI.
4. Verifies the existing suite actually exceeds 80% on every gated metric; adds targeted tests only if a gated metric lands under 80.

## Decisions (locked during brainstorming)

| Decision | Choice |
|----------|--------|
| Coverage provider | `@vitest/coverage-v8` (V8 native, the Vitest default) |
| Gated metrics | All four — lines, statements, functions, branches — at 80% |
| Threshold scope | **Global** (a single "limit", not per-file) |
| Coverage denominator | `all: true` over `src/**` — untested real code counts |
| Exceed-80 handling | Clear the gated metrics with real tests; do **not** lower the gate to fit current coverage. No mandated buffer above 80. |
| Codecov upload | Once per CI run; `fail_ci_if_error: false` (local gate already fails the build) |
| CI Node version | **Node 24 only** — Node 20 job removed (past EOL); matrix dropped |

## Changes

### 1. Dependency

Add `@vitest/coverage-v8` (matching the installed Vitest `^2.1.8`) to `devDependencies`.

### 2. `vitest.config.ts`

Add a `coverage` block to the existing `test` config (keep `globals`, `environment: 'jsdom'`, `setupFiles`):

- `provider: 'v8'`
- `all: true`
- `include: ['src/**']`
- `reporter: ['text', 'lcov', 'html']`
- `exclude`:
  - `**/__tests__/**`
  - `**/*.test.{ts,tsx}`
  - `src/test-setup.ts`
  - `**/*.config.*`
  - `examples/**`
  - `dist/**`
  - `**/*.d.ts`
  - `src/engine/types.ts` (type-only declarations, no runtime code)
  - `src/*/index.ts` (pure re-export barrels: `src/engine/index.ts`, `src/react/index.ts`, `src/vanilla/index.ts`)
- `thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 }`

### 3. `package.json`

- Change `test` script: `vitest run` → `vitest run --coverage`. ("Replace the existing testing" — the default test command now reports coverage and enforces the gate.)
- `test:watch` unchanged (no coverage in the TDD loop).
- `@vitest/coverage-v8` present in `devDependencies`.

### 4. `.github/workflows/ci.yml`

- Remove the `strategy.matrix` (was `node-version: [20, 24]`).
- Single job on `node-version: 24` (`actions/setup-node@v4`, `cache: npm`).
- Steps unchanged through `npm test` (which now runs coverage and enforces the 80% gate).
- After `npm test`, add a Codecov upload step:
  ```yaml
  - uses: codecov/codecov-action@v5
    with:
      token: ${{ secrets.CODECOV_TOKEN }}
      files: ./coverage/lcov.info
      fail_ci_if_error: false
  ```
- `npm run build` and `npm pack --dry-run` steps unchanged.

> The `CODECOV_TOKEN` secret is added by the maintainer outside this change.

### 5. `codecov.yml`

Minimal config aligning Codecov's PR status with the local gate:

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

### 6. `.gitignore`

Add `coverage/` so the generated report directory is never committed.

### 7. Documentation

- `README.md`: add a Codecov badge near the top and a one-line "Coverage" note (suite is gated at 80%; `npm test` reports coverage).
- `CLAUDE.local.md`: update the commands table — `npm test` now runs coverage and enforces the 80% gate; optionally note `--coverage` artifacts land in `coverage/`.

## Verification

After wiring, run `npm test` and capture the real coverage table.

- **Expected:** with the excludes above, all four global metrics clear 80% (baseline `src/`-only was ~95/91/90/95).
- **If any gated metric < 80%:** add focused tests at the weakest real modules (candidates from baseline: `src/react/useWhichKeyState.ts` branches, `src/vanilla/cheatsheet.ts` truncation path) until the metric passes. Re-run until green.
- Report the final numbers regardless.

Full pre-push gate must pass: `npm run lint && npm run typecheck && npm test && npm run build`.

## Invariants this feature depends on

- **`coverage/lcov.info` is produced by the `lcov` reporter** — the Codecov upload `files:` path depends on it. If the reporter list changes, update the CI path.
- **`npm test` runs with `--coverage`** — CI relies on the test script (not a separate command) to both gate coverage and emit the lcov file the upload consumes. A future change that splits coverage into its own script must update CI to call it before the Codecov step.

## Out of scope

- Per-file thresholds (possible future tightening).
- Bumping `package.json` `engines` (`>=20`) — runtime support claim is independent of CI Node version.
- Coverage badges beyond Codecov.
