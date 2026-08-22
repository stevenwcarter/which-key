# Contributing

## Dev setup

```bash
git clone https://github.com/stevenwcarter/which-key.git
cd which-key
npm i
```

### Useful commands

| Command              | Description                                         |
| -------------------- | --------------------------------------------------- |
| `npm test`           | Run all tests with Vitest (single run)              |
| `npm run test:watch` | Re-run tests on file change                         |
| `npm run build`      | Compile with tsup (dual CJS+ESM, type declarations) |
| `npm run typecheck`  | `tsc --noEmit` — catch type errors without building |
| `npm run lint`       | ESLint                                              |
| `npm run format`     | Prettier                                            |

### TDD workflow

This project uses test-driven development. Before touching source code:

1. Write a failing test in the appropriate `__tests__/` directory.
2. Run `npm run test:watch` to see it fail.
3. Implement the minimal code to make it pass.
4. Refactor, keeping tests green.

Keep tests co-located with source:

```
src/
  engine/
    __tests__/      ← engine unit tests
  react/
    __tests__/      ← React component / hook tests
  vanilla/
    __tests__/      ← vanilla renderer tests
```

## Submitting a PR

1. Fork the repo and create a feature branch from `main`.
2. Follow the TDD workflow above.
3. Run the full suite before pushing:

   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```

4. Write [Conventional Commit](https://www.conventionalcommits.org/) messages (`feat:`, `fix:`, `docs:`, `test:`, `build:`, `chore:`, …). A husky `commit-msg` hook enforces the format; the version bump and changelog are derived from these messages at release time.

5. Push and open a PR against `main`. CI will run lint, typecheck, tests, build, and `npm pack --dry-run`.

## Releasing (maintainers)

Versioning is driven by Conventional Commits via [`commit-and-tag-version`](https://github.com/absolute-version/commit-and-tag-version). While the package is pre-1.0 (`0.x`), semver-for-0.x rules apply: `fix:`→patch, `feat:`→patch, `feat!:`/`BREAKING CHANGE:`→minor (after `1.0.0`: `feat:`→minor, `feat!:`→major).

```bash
npm run release:dry   # preview the next version + changelog (no changes)
npm run release       # bump version, regenerate CHANGELOG.md, commit, and tag
```

`npm run release` does not push or publish. See the README "Releasing" section for the full flow (including the one-time first release and the manual publish steps).

## Code style

- TypeScript with strict mode — no `any` unless unavoidable and justified.
- No default exports (except in example files where frameworks expect them).
- Use named exports everywhere.
- Keep the engine (`src/engine/`) free of DOM and framework dependencies.
