import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: [
      'lib/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'scripts/**/*.test.ts',
      'db/**/*.test.ts',
    ],
    environment: 'node',
  },
});
