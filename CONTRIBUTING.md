# Contributing

## Dev setup

```bash
git clone https://github.com/stevenwcarter/which-key.git
cd which-key
npm i
```

### Useful commands

| Command              | Description                                           |
|----------------------|-------------------------------------------------------|
| `npm test`           | Run all tests with Vitest (single run)                |
| `npm run test:watch` | Re-run tests on file change                           |
| `npm run build`      | Compile with tsup (dual CJS+ESM, type declarations)   |
| `npm run typecheck`  | `tsc --noEmit` — catch type errors without building   |
| `npm run lint`       | ESLint                                                |
| `npm run format`     | Prettier                                              |

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

4. Add a changeset describing your change:

   ```bash
   npx changeset
   ```

   Select the bump level (`patch` for fixes, `minor` for new features, `major` for breaking changes) and write a one-line summary.

5. Push and open a PR against `main`. CI will run lint, typecheck, tests, build, and `npm pack --dry-run`.

## Changesets

This project uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every PR that changes behaviour (engine, React binding, vanilla renderer, or the prebuilt CSS) needs a changeset. Documentation-only PRs may omit one.

```bash
npx changeset          # interactive: choose bump + write summary
npx changeset version  # maintainer-only: bump versions + update CHANGELOG
npx changeset publish  # maintainer-only: publish to npm
```

## Code style

- TypeScript with strict mode — no `any` unless unavoidable and justified.
- No default exports (except in example files where frameworks expect them).
- Use named exports everywhere.
- Keep the engine (`src/engine/`) free of DOM and framework dependencies.
