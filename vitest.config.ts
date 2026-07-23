import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sp\/geometry\/(.*)$/, replacement: path.resolve(__dirname, 'packages/geometry/src') + '/$1.ts' },
      { find: '@sp/geometry', replacement: path.resolve(__dirname, 'packages/geometry/src/index.ts') },
      { find: /^@sp\/email-provider$/, replacement: path.resolve(__dirname, 'packages/email-provider/src/index.ts') },
      { find: /^@sp\/jobs$/, replacement: path.resolve(__dirname, 'packages/jobs/src/index.ts') },
      { find: /^@sp\/costing$/, replacement: path.resolve(__dirname, 'packages/costing/src/index.ts') },
      { find: '@sp/theme', replacement: path.resolve(__dirname, 'packages/theme/src/index.ts') },
      { find: '@/lib/enquiryEstimate', replacement: path.resolve(__dirname, 'apps/marketing/lib/enquiryEstimate.ts') },
      { find: '@/lib/enquiryBudgets', replacement: path.resolve(__dirname, 'apps/marketing/lib/enquiryBudgets.ts') },
      { find: '@/lib/sharedEmails', replacement: path.resolve(__dirname, 'apps/marketing/lib/sharedEmails.ts') },
      { find: /^@\/lib\/email\/(.*)$/, replacement: path.resolve(__dirname, 'apps/marketing/lib/email') + '/$1' },
      { find: /^@\/emails\/(.*)$/, replacement: path.resolve(__dirname, 'apps/marketing/emails') + '/$1' },
      { find: '@/lib/quotes/publicQuote', replacement: path.resolve(__dirname, 'test/shims/marketing-publicQuote.ts') },
      { find: '@/lib/invoices/publicInvoice', replacement: path.resolve(__dirname, 'test/shims/marketing-publicInvoice.ts') },
      { find: /^@\/lib\/emails\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib/emails') + '/$1' },
      { find: /^@\/lib\/projects\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib/projects') + '/$1' },
      { find: /^@\/lib\/quotes\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/lib/quotes') + '/$1' },
      { find: /^@\/app\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/app') + '/$1' },
      { find: /^@\/components\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/components') + '/$1' },
      { find: /^@\/src\/(.*)$/, replacement: path.resolve(__dirname, 'apps/portal/src') + '/$1' },
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
    setupFiles: [path.resolve(__dirname, 'test/setup/jsdomSvgPolyfill.ts')],
  },
});
