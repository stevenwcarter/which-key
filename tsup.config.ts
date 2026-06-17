import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'engine/index': 'src/engine/index.ts',
    'react/index': 'src/react/index.ts',
    'vanilla/index': 'src/vanilla/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ['react', 'react-dom'],
  // Copy the stylesheet to dist/styles.css
  async onSuccess() {
    const { copyFile } = await import('node:fs/promises');
    await copyFile('src/styles.css', 'dist/styles.css');
  },
});
