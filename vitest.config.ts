import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@sp/theme', replacement: path.resolve(__dirname, 'packages/theme/src/index.ts') },
      { find: /^@\/lib\/emails\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib/emails') + '/$1' },
      { find: /^@\/lib\/projects\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib/projects') + '/$1' },
      { find: /^@\/lib\/quotes\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib/quotes') + '/$1' },
      { find: /^@\/app\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/app') + '/$1' },
      { find: /^@\/components\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/components') + '/$1' },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib') + '/$1' },
      { find: '@', replacement: path.resolve(__dirname) },
      { find: 'server-only', replacement: path.resolve(__dirname, 'test/shims/server-only.ts') },
    ],
  },
  css: {
    postcss: {
      plugins: [],
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
