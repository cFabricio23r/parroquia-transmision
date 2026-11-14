import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['pruebas/**/*.test.{ts,tsx}'],
    fileParallelism: false,
  },
});
