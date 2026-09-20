import { test, expect } from '@playwright/test'
import { registerAuftraggeber, registerSubunternehmer, login, logout, uniqueEmail, resetRateLimits } from './helpers'

test.describe('Registrierung, Login, Logout', () => {
  test.beforeAll(async () => {
    await resetRateLimits()
  })

  test('ein Auftraggeber kann sich registrieren und landet eingeloggt im Dashboard', async ({ page }) => {
    const email = uniqueEmail('ag')
    await registerAuftraggeber(page, { email, password: 'sicheres-passwort-123', companyName: 'Test AG GmbH' })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('ein Unternehmer kann sich mit Gewerk-Auswahl registrieren', async ({ page }) => {
    const email = uniqueEmail('un')
    await registerSubunternehmer(page, {
      email,
      password: 'sicheres-passwort-123',
      companyName: 'Test Handwerk GmbH',
      gewerk: 'Trockenbau',
    })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Login mit korrekten Zugangsdaten funktioniert, mit falschem Passwort nicht', async ({ page }) => {
    const email = uniqueEmail('login')
    const password = 'sicheres-passwort-123'
    await registerAuftraggeber(page, { email, password, companyName: 'Login Test GmbH' })
    await logout(page, 'Login Test GmbH')

    await page.goto('/login')
    await page.getByLabel('E-Mail').fill(email)
    await page.getByLabel('Passwort').fill('falsches-passwort')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/falsch/i)

    await login(page, email, password)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Logout beendet die Session tatsächlich (Dashboard danach nicht mehr erreichbar)', async ({ page }) => {
    const email = uniqueEmail('logout')
    const password = 'sicheres-passwort-123'
    await registerAuftraggeber(page, { email, password, companyName: 'Logout Test GmbH' })
    await logout(page, 'Logout Test GmbH')

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
