import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'examples', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // tsconfig's `include` is ["src"], so tsup.config.ts / vitest.config.ts
        // have no owning project; allowDefaultProject gives them an inferred one.
        projectService: { allowDefaultProject: ['*.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // WhichKeyEngine/LayerHandle declare their members with method shorthand,
      // but the implementation is a closure object that never reads `this` —
      // controller.test.ts pins that ("pushLayer works when destructured").
      // Passing engine.subscribe/getSnapshot to useSyncExternalStore is the
      // intended usage, so this rule is a pure false positive here.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['src/react/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['src/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
