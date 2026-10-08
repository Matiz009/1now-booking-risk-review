import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// `defineConfig` comes from vitest/config (not vite) so the `test` key is typed.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // We import describe/it/expect explicitly instead of relying on globals,
    // so a reader can always see where a test helper comes from.
    globals: false,
    css: false,
    // Worker threads instead of the default child processes. On a Windows
    // machine low on memory, with on-access antivirus scanning, a forked worker
    // could take longer than Vitest's fixed 60 s to start, and whole test files
    // failed with "Failed to start forks worker". Threads don't spawn a new
    // node.exe per worker and use less memory.
    pool: 'threads',
    // `npm run test:coverage`. Measures app code only: tests, test setup and
    // the entry file (which only mounts <App />) are left out.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
