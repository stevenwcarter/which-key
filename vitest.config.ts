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
