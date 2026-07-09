import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: [
      'lib/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'scripts/**/*.test.ts',
      'db/**/*.test.ts',
      'app/**/*.test.tsx',
    ],
    environment: 'node',
    // Component tests opt into jsdom per file via @vitest-environment.
  },
});
