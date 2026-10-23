import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['test/**/*.test.ts'], globalSetup: ['test/global-setup.ts'], setupFiles: ['test/env.ts'], testTimeout: 30_000, hookTimeout: 60_000, fileParallelism: false, pool: 'forks' },
});
