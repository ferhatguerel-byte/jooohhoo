import { test, expect } from '@playwright/test'
import {
  registerAuftraggeber,
  registerSubunternehmer,
  activateSubscription,
  uniqueEmail,
  login,
  resetRateLimits,
} from './helpers'

const GEWERK = 'Trockenbau'

test.describe.serial('Auftrag → Angebot → Vergabe → Nachricht → Bewertung', () => {
  test.beforeAll(async () => {
    await resetRateLimits()
  })

  const jobTitle = `E2E Testauftrag ${Date.now()}`
  const agEmail = uniqueEmail('flow-ag')
  const otherAgEmail = uniqueEmail('flow-ag-other')
  const unEmail = uniqueEmail('flow-un')
  const password = 'sicheres-passwort-123'
  let jobUrl = ''

  test('Auftraggeber erstellt einen Auftrag und sieht ihn danach in der eigenen Liste', async ({ page }) => {
    await registerAuftraggeber(page, { email: agEmail, password, companyName: 'Flow AG GmbH' })

    await page.getByRole('button', { name: '+ Neuen Auftrag einstellen' }).click()
    await page.getByLabel('Titel *').fill(jobTitle)
    await page.getByLabel('Hauptgewerk *').selectOption(GEWERK)
    await page.getByLabel('PLZ *').fill('10115')
    await page.getByLabel('Ort *').fill('Berlin')
    await page.getByLabel(/Projektbeschreibung/).fill('Dies ist eine ausführliche Testbeschreibung für den E2E-Testauftrag.')
    await page.getByRole('button', { name: 'Ohne Leistungsverzeichnis veröffentlichen' }).click()

    await expect(page.getByText(jobTitle)).toBeVisible()

    await page.getByRole('link', { name: new RegExp(jobTitle) }).click()
    await page.waitForURL(/\/dashboard\/auftraege\/[a-f0-9-]+/)
    jobUrl = page.url()
    await expect(page.getByRole('heading', { name: jobTitle })).toBeVisible()
  })

  test('ein anderer Auftraggeber kann den fremden Auftrag NICHT sehen (IDOR)', async ({ page }) => {
    await registerAuftraggeber(page, { email: otherAgEmail, password, companyName: 'Fremder AG GmbH' })
    await page.goto(jobUrl)
    // notFound() rendert Next.js' 404-Seite statt der Auftragsdaten.
    await expect(page.locator('body')).not.toContainText(jobTitle)
  })

  test('Unternehmer mit passendem Gewerk sieht den offenen Auftrag im Marktplatz', async ({ page }) => {
    await registerSubunternehmer(page, { email: unEmail, password, companyName: 'Flow UN GmbH', gewerk: GEWERK })
    await activateSubscription(unEmail)

    await page.goto('/dashboard/jobs')
    await expect(page.getByText(jobTitle)).toBeVisible()
  })

  test('Unternehmer kann ein Angebot abgeben', async ({ page }) => {
    await login(page, unEmail, password)
    await page.goto('/dashboard/jobs')
    const jobCard = page.locator('div', { hasText: jobTitle }).first()
    await jobCard.getByRole('button', { name: 'Angebot abgeben' }).click()
    await page.getByPlaceholder('Preis in €').fill('5000')
    await page.getByRole('button', { name: 'Angebot senden' }).click()
    await expect(page.getByText(/Angebot abgegeben/)).toBeVisible()
  })

  test('Auftraggeber sieht das eingegangene Angebot', async ({ page }) => {
    await login(page, agEmail, password)
    await page.goto(jobUrl)
    await expect(page.getByText('Flow UN GmbH')).toBeVisible()
  })

  test('Auftraggeber und Unternehmer können Nachrichten zu einem Angebot austauschen', async ({ page }) => {
    await login(page, agEmail, password)
    await page.goto(jobUrl)
    await page.getByRole('button', { name: /Nachrichten/ }).click()
    await page.getByPlaceholder('Nachricht schreiben…').fill('Können Sie am Montag beginnen?')
    await page.getByRole('button', { name: 'Senden' }).click()
    await expect(page.getByText('Können Sie am Montag beginnen?')).toBeVisible()
  })

  test('Auftraggeber kann das Angebot annehmen (Auftrag vergeben)', async ({ page }) => {
    await login(page, agEmail, password)
    await page.goto(jobUrl)
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '✓ Auftrag vergeben' }).click()
    await expect(page.getByText('Vergeben')).toBeVisible()
  })

  test('Auftraggeber kann den beauftragten Unternehmer bewerten', async ({ page }) => {
    await login(page, agEmail, password)
    await page.goto(jobUrl)
    await page.getByRole('button', { name: '5 Sterne' }).click()
    await page.getByRole('button', { name: 'Bewertung speichern' }).click()
    await expect(page.getByText('✓ Bewertung gespeichert')).toBeVisible()
  })
})
