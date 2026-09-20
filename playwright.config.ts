import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Diese Sandbox bringt eine feste Chromium-Version vorinstalliert mit, die von der
        // gerade installierten @playwright/test-Version abweichen kann.
        launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
      },
    },
  ],
  webServer: {
    // Production-Build statt "next dev": vermeidet dev-server-spezifische Instabilität
    // (HMR/Turbopack-Websocket-Aussetzer) und bildet das reale Deployment-Verhalten ab.
    // Erwartet einen vorherigen "npm run build" mit passenden Env-Vars.
    command: 'npx next start -p 3100',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      NEXT_PUBLIC_APP_URL: BASE_URL,
      SESSION_SECRET: process.env.SESSION_SECRET || 'e2e-test-session-secret-not-for-production',
      DATABASE_URL: process.env.DATABASE_URL || '',
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin-e2e@example.com',
    },
  },
})
