import { test, expect } from '@playwright/test'
import { registerAuftraggeber, uniqueEmail, seedResetToken, login, resetRateLimits } from './helpers'

test.describe('Passwort-Reset', () => {
  test.beforeAll(async () => {
    await resetRateLimits()
  })

  test('Anfrage zeigt immer dieselbe Bestätigung (keine Rückschlüsse auf Kontoexistenz)', async ({ page }) => {
    await page.goto('/passwort-vergessen')
    await page.getByLabel('E-Mail').fill('does-not-exist@example.com')
    await page.getByRole('button', { name: 'Link zusenden' }).click()
    await expect(page.getByText(/haben wir Ihnen einen Link/i)).toBeVisible()
  })

  test('mit gültigem Token kann ein neues Passwort gesetzt und damit eingeloggt werden', async ({ page }) => {
    // Hinweis: Der E-Mail-Versand selbst wird hier nicht durchlaufen (siehe Testbericht) –
    // der Token wird direkt in der DB erzeugt, wie es sonst der Mail-Link täte.
    const email = uniqueEmail('reset')
    const oldPassword = 'altes-passwort-123'
    const newPassword = 'neues-passwort-456'
    await registerAuftraggeber(page, { email, password: oldPassword, companyName: 'Reset Test GmbH' })

    const token = await seedResetToken(email)
    await page.goto(`/passwort-vergessen/neu?token=${token}`)
    await page.getByLabel('Neues Passwort').fill(newPassword)
    await page.getByLabel('Passwort bestätigen').fill(newPassword)
    await page.getByRole('button', { name: 'Neues Passwort speichern' }).click()
    await page.waitForURL('**/login**')

    await login(page, email, newPassword)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('ein abgelaufener/ungültiger Token wird abgelehnt', async ({ page }) => {
    await page.goto('/passwort-vergessen/neu?token=definitiv-ungueltig')
    await page.getByLabel('Neues Passwort').fill('irgendein-passwort-123')
    await page.getByLabel('Passwort bestätigen').fill('irgendein-passwort-123')
    await page.getByRole('button', { name: 'Neues Passwort speichern' }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/ungültig|abgelaufen/i)
  })
})
