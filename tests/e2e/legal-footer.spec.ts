import { test, expect } from '@playwright/test'
import { registerSubunternehmer, uniqueEmail, resetRateLimits, db } from './helpers'

/**
 * Phase 4.1 – Regression für den globalen Footer (Teil D/E) und für den Stored-XSS-Fix im
 * JSON-LD von /firma/[slug] (Teil A/N). Prüft die tatsächlich gerenderte DOM-Ausgabe im
 * echten Browser, nicht nur die Serialisierungsfunktion isoliert (siehe tests/seo/json-ld-safety.test.ts).
 */

const LEGAL_LINKS: { name: RegExp; href: string }[] = [
  { name: /^Impressum$/, href: '/impressum' },
  { name: /^Datenschutz$/, href: '/datenschutz' },
  { name: /^AGB$/, href: '/agb' },
  { name: /^Widerruf$/, href: '/widerruf' },
]

async function expectFooterLinks(page: import('@playwright/test').Page) {
  const footer = page.locator('footer')
  await expect(footer).toBeVisible()
  for (const link of LEGAL_LINKS) {
    await expect(footer.getByRole('link', { name: link.name })).toHaveAttribute('href', link.href)
  }
}

test.describe('Globaler Footer – Erreichbarkeit der Rechtstexte (Phase 4.1)', () => {
  test('Startseite verlinkt Impressum/Datenschutz/AGB/Widerruf im Footer', async ({ page }) => {
    await page.goto('/')
    await expectFooterLinks(page)
  })

  test('Branchenbuch verlinkt die Rechtstexte im Footer', async ({ page }) => {
    await page.goto('/branchenbuch')
    await expectFooterLinks(page)
  })

  test('Login-Seite verlinkt die Rechtstexte im Footer', async ({ page }) => {
    await page.goto('/login')
    await expectFooterLinks(page)
  })

  test('Registrierungs-Seite verlinkt die Rechtstexte im Footer', async ({ page }) => {
    await page.goto('/registrieren')
    await expectFooterLinks(page)
  })

  test('Impressum/Datenschutz/AGB/Widerruf sind direkt erreichbar (kein 404)', async ({ page }) => {
    for (const link of LEGAL_LINKS) {
      const res = await page.goto(link.href)
      expect(res?.status()).toBe(200)
    }
  })

  test('Widerruf-Seite erfindet keinen eigenen Rechtstext, sondern verweist auf die AGB', async ({ page }) => {
    await page.goto('/widerruf')
    await expect(page.getByRole('link', { name: 'AGB, § 3' })).toHaveAttribute('href', '/agb')
    await expect(page.getByRole('link', { name: 'AGB, § 2' })).toHaveAttribute('href', '/agb')
  })
})

test.describe('Firma-Seite: kein Dashboard-Footer nötig, öffentlicher Footer vorhanden + Stored-XSS-Fix', () => {
  test.beforeAll(async () => {
    await resetRateLimits()
  })

  test('Firmenname mit Script-Payload wird als reiner Text angezeigt, kein Skript wird ausgeführt (Stored-XSS)', async ({ page }) => {
    const email = uniqueEmail('xss')
    const payloadName = 'Test</script><script>window.__xss_pwned=1</script>GmbH'

    await registerSubunternehmer(page, {
      email,
      password: 'sicheres-passwort-123',
      companyName: payloadName,
      gewerk: 'Trockenbau',
    })

    const userResult = await db().query('SELECT id FROM users WHERE email = $1', [email])
    const userId = userResult.rows[0].id
    await db().query(
      `UPDATE users SET directory_listed = true, subscription_status = 'active', subscription_tier = 'monthly' WHERE id = $1`,
      [userId]
    )
    const slugResult = await db().query('SELECT company_slug FROM users WHERE id = $1', [userId])
    let slug = slugResult.rows[0].company_slug
    if (!slug) {
      // Slug wird erst beim ersten Rendern der Firmenlisten (ensureCompanySlugs) erzeugt –
      // ein Aufruf der Branchenbuch-Seite stößt dies serverseitig an.
      await page.goto('/branchenbuch')
      const retry = await db().query('SELECT company_slug FROM users WHERE id = $1', [userId])
      slug = retry.rows[0].company_slug
    }
    expect(slug).toBeTruthy()

    let xssFired = false
    page.on('dialog', async (dialog) => {
      xssFired = true
      await dialog.dismiss()
    })

    await page.goto(`/firma/${slug}`)

    // Der injizierte Script-Block darf nie tatsächlich ausgeführt worden sein.
    const pwned = await page.evaluate(() => (window as unknown as { __xss_pwned?: number }).__xss_pwned)
    expect(pwned).toBeUndefined()
    expect(xssFired).toBe(false)

    // Der Firmenname wird als Text angezeigt (der Browser hat KEIN eigenes <script>-Element
    // aus dem Payload geparst – der Titel enthält den Rohtext, keine ausgeführte Payload).
    await expect(page.locator('h1')).toContainText('GmbH')

    // Alle eingebetteten JSON-LD-Blöcke müssen weiterhin syntaktisch gültiges JSON sein.
    const ldJsonBlocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(ldJsonBlocks.length).toBeGreaterThan(0)
    for (const block of ldJsonBlocks) {
      expect(() => JSON.parse(block)).not.toThrow()
    }

    await expectFooterLinks(page)
  })
})
