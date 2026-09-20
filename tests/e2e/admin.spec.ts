import { test, expect } from '@playwright/test'
import { registerAuftraggeber, uniqueEmail, resetRateLimits } from './helpers'

// ADMIN_EMAIL wird dem Webserver-Prozess über playwright.config.ts mitgegeben.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin-e2e@example.com'
const ADMIN_PASSWORD = 'admin-sicheres-passwort-123'

test.describe('Admin-Authorization', () => {
  test.beforeAll(async () => {
    await resetRateLimits()
  })

  test('der Admin kann sich einloggen und das Admin-Dashboard öffnen', async ({ page }) => {
    await registerAuftraggeber(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, companyName: 'BAUVERSUS Admin' })
    await page.goto('/dashboard/admin')
    await expect(page).toHaveURL(/\/dashboard\/admin/)
    await expect(page.locator('body')).not.toContainText(/Zugriff verweigert/i)
  })

  test('ein normaler Nutzer kann den Admin-Bereich NICHT öffnen (Privilege Escalation)', async ({ page }) => {
    const email = uniqueEmail('normal-user')
    const password = 'sicheres-passwort-123'
    await registerAuftraggeber(page, { email, password, companyName: 'Normaler Nutzer GmbH' })

    await page.goto('/dashboard/admin')
    // requireAdmin() leitet serverseitig weg – die Admin-Seite wird nie ausgeliefert (welche
    // /dashboard/*-Unterseite genau angezeigt wird, ist für diesen Test nicht relevant).
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page).not.toHaveURL(/\/dashboard\/admin/)

    // Auch die Admin-API direkt anzusprechen darf nicht funktionieren.
    const res = await page.request.post('/api/admin/verify', { data: { userId: 'irrelevant', status: 'verified' } })
    expect(res.status()).toBe(403)
  })

  test('ein nicht angemeldeter Besucher wird von Admin-Seiten zum Login geleitet', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/dashboard/admin')
    await expect(page).toHaveURL(/\/login/)
  })
})
