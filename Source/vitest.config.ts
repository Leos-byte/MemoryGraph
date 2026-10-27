import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests-electron/**/*.test.ts'], pool: 'forks', maxWorkers: 1 } });
