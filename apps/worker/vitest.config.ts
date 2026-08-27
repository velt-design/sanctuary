import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { resolveVitestMaxWorkers } from '../../test/vitestWorkerPolicy';

const workerDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sp/email-provider': path.resolve(workerDirectory, '../../packages/email-provider/src/index.ts'),
      '@sp/jobs': path.resolve(workerDirectory, '../../packages/jobs/src/index.ts'),
    },
  },
  test: {
    maxWorkers: resolveVitestMaxWorkers(),
    environment: 'node',
    include: ['src/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
