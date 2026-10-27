import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests-electron/e2e', workers: 1, timeout: 45000, use: { trace: 'retain-on-failure' }, reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] });
