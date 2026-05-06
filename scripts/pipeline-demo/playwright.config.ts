import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 180_000,
  use: {
    baseURL: 'http://localhost:8080',
    headless: false,
  },
});
