import { defineConfig, devices } from '@playwright/test'

/**
 * QA harness. Runs against a production build on port 3100 so it cannot collide
 * with a developer's `next dev` on 3000, and so what is tested is what ships.
 *
 * `workers: 4` is safe because every test mints its own uniquely-named records
 * (see tests/e2e/_helpers/data.ts). Nothing shared is mutated, and no assertion
 * depends on a global row count.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  /**
   * A PRODUCTION build, deliberately.
   *
   * Two reasons. It is what ships; and `next dev` in this environment cannot
   * boot its client runtime (the Turbopack HMR websocket fails to handshake),
   * so nothing on the page ever hydrates and every UI assertion would report a
   * broken app that is not actually broken. Running `next start` requires the
   * cookie fix in lib/auth.ts — before it, a production build over plain HTTP
   * could not hold a session at all. See QA-REPORT.md, finding F1.
   */
  webServer: {
    command: 'npx next start -p 3100',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    /**
     * The harness serves a production build over plain HTTP, so it opts out of
     * the Secure flag the same way a local demo does — explicitly, at startup,
     * rather than by having the server sniff a request header it cannot trust.
     * A deployment that forgets this variable still gets Secure.
     */
    env: { ...process.env, COOKIE_SECURE: 'false' },
  },
})
