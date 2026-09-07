import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // jsdom + Testing Library role queries are slow on a cold worker. The default
    // 5s is enough per-test but not when several suites boot in parallel, which
    // made GlobalTable fail in a full run yet pass when run alone. Raising the
    // ceiling removes the flake without hiding a real hang.
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
