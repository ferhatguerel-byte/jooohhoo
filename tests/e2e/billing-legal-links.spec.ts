import { test, expect } from '@playwright/test'
import { registerSubunternehmer, uniqueEmail, login, activateSubscription, resetRateLimits } from './helpers'

/**
 * Phase 2B (Aufgabe 4/5) – Regression dafür, dass die Rechtstexte jetzt auch im eingeloggten
 * Abo-/Mitgliedschafts-Bereich erreichbar sind (siehe Phase 2A, Abschnitt 5: vorher dort gar
 * nicht erreichbar, da SiteFooter bewusst nicht im Dashboard-Layout eingebunden ist). Prüft
 * sowohl Desktop- als auch Mobil-Viewport, da die Links per CSS (flex-wrap) niemals komplett
 * ausgeblendet werden sollten.
 *
 * HINWEIS zur tatsächlichen Ausführung in dieser Sandbox: `npm run test:e2e` benötigt einen
 * laufenden Production-Build gegen eine echte Postgres-Instanz (siehe playwright.config.ts,
 * webServer) sowie STRIPE_*-Testkonfiguration. In dieser Sandbox ist kein Postgres-Server
 * erreichbar (siehe Abschlussbericht) – diese Spezifikation ist daher geschrieben und
 * lint-/typecheck-geprüft, aber NICHT tatsächlich gegen einen laufenden Server ausgeführt worden.
 */

const LEGAL_LINKS: { name: RegExp; href: string }[] = [
  { name: /^AGB$/, href: '/agb' },
  { name: /^Datenschutz$/, href: '/datenschutz' },
  { name: /^Impressum$/, href: '/impressum' },
  { name: /^Widerruf$/, href: '/widerruf' },
]

async function expectBillingLegalLinks(page: import('@playwright/test').Page) {
  const nav = page.getByRole('navigation', { name: 'Rechtliche Informationen' })
  await expect(nav).toBeVisible()
  for (const link of LEGAL_LINKS) {
    await expect(nav.getByRole('link', { name: link.name })).toHaveAttribute('href', link.href)
  }
}

test.describe('Abo-Bereich: Rechtstext-Links erreichbar (Phase 2B)', () => {
  test.beforeAll(async () => {
    await resetRateLimits()
  })

  test('Desktop: /dashboard/abo zeigt AGB/Datenschutz/Impressum/Widerruf-Links', async ({ page }) => {
    const email = uniqueEmail('legal-abo-desktop')
    await registerSubunternehmer(page, { email, password: 'sicheres-passwort-123', companyName: 'Test GmbH', gewerk: 'Trockenbau' })
    await activateSubscription(email, 'monthly')
    await page.goto('/dashboard/abo')
    await expectBillingLegalLinks(page)
  })

  test('Mobil-Viewport: Links bleiben sichtbar und ohne horizontales Scrollen erreichbar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const email = uniqueEmail('legal-abo-mobile')
    await registerSubunternehmer(page, { email, password: 'sicheres-passwort-123', companyName: 'Test GmbH', gewerk: 'Trockenbau' })
    await activateSubscription(email, 'yearly')
    await page.goto('/dashboard/abo')
    await expectBillingLegalLinks(page)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('Mitgliedschaftsseite (Kündigungsbereich) zeigt dieselben Rechtstext-Links', async ({ page }) => {
    const email = uniqueEmail('legal-mitgliedschaft')
    const password = 'sicheres-passwort-123'
    await registerSubunternehmer(page, { email, password, companyName: 'Test GmbH', gewerk: 'Trockenbau' })
    await activateSubscription(email, 'yearly')
    await login(page, email, password)
    await page.goto('/dashboard/einstellungen/mitgliedschaft')
    await expectBillingLegalLinks(page)
  })
})
