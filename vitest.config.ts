import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@sp/theme': path.resolve(__dirname, 'packages/theme/src/index.ts'),
      'server-only': path.resolve(__dirname, 'test/shims/server-only.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
  },
});
