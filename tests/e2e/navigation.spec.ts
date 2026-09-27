import { test, expect } from '@playwright/test'
import { registerSubunternehmer, uniqueEmail, db } from './helpers'

/**
 * Regression: HomeHeader.tsx verlinkte "So funktioniert's"/"Vorteile"/"Für Unternehmen" bisher mit
 * bloßem href="#..." – das funktioniert nur auf der Startseite selbst, da die Zielabschnitte
 * (id="so-funktionierts" etc.) ausschließlich in src/app/page.tsx existieren. Auf jeder anderen
 * Seite (z.B. /branchenbuch), die denselben Header wiederverwendet, lief der Klick ins Leere.
 * Fix: die Links zeigen jetzt auf "/#..." (Next.js Link navigiert bei Bedarf zur Startseite und
 * scrollt dort automatisch zum Abschnitt).
 */
test.describe('Branchenbuch – Header-Anker zu den Startseiten-Abschnitten', () => {
  test('Klick auf "So funktioniert\'s" von /branchenbuch aus navigiert zur Startseite und scrollt zum Abschnitt', async ({ page }) => {
    await page.goto('/branchenbuch')
    await page.getByRole('link', { name: "So funktioniert's" }).click()
    await page.waitForURL('**/#so-funktionierts')
    await expect(page.locator('#so-funktionierts')).toBeInViewport()
  })

  test('Klick auf "Vorteile" von /branchenbuch aus navigiert zur Startseite und scrollt zum Abschnitt', async ({ page }) => {
    await page.goto('/branchenbuch')
    await page.getByRole('link', { name: 'Vorteile' }).click()
    await page.waitForURL('**/#vorteile')
    await expect(page.locator('#vorteile')).toBeInViewport()
  })

  test('Klick auf "Für Unternehmen" von /branchenbuch aus navigiert zur Startseite und scrollt zum Abschnitt', async ({ page }) => {
    await page.goto('/branchenbuch')
    await page.getByRole('link', { name: 'Für Unternehmen' }).click()
    await page.waitForURL('**/#unternehmen')
    await expect(page.locator('#unternehmen')).toBeInViewport()
  })

  test('direkter Aufruf von /#so-funktionierts scrollt sofort zum richtigen Abschnitt', async ({ page }) => {
    await page.goto('/#so-funktionierts')
    await expect(page.locator('#so-funktionierts')).toBeInViewport()
  })

  test('alle drei Ziel-IDs existieren genau einmal auf der Startseite (keine Duplikate)', async ({ page }) => {
    await page.goto('/')
    for (const id of ['so-funktionierts', 'vorteile', 'unternehmen']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
  })
})

test.describe('Globaler Zurück-Button', () => {
  test('erscheint nicht auf der Startseite', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Zurück zur vorherigen Seite' })).toHaveCount(0)
  })

  test('erscheint auf /branchenbuch und führt bei vorhandenem In-App-Verlauf zur vorherigen Seite zurück', async ({ page }) => {
    await page.goto('/')
    await page.locator('header').getByRole('link', { name: 'Branchenbuch', exact: true }).click()
    await page.waitForURL('**/branchenbuch')
    const backButton = page.getByRole('button', { name: 'Zurück zur vorherigen Seite' })
    await expect(backButton).toBeVisible()
    await backButton.click()
    await page.waitForURL('**/')
  })

  test('Fallback bei direktem Einstieg ohne In-App-Verlauf: führt auf die Branchenbuch-Übersicht statt ins Leere', async ({ context }) => {
    // Neuer Tab mit direktem Einstieg auf eine Detailseite -> history.length === 1 in diesem Tab.
    const freshPage = await context.newPage()
    await freshPage.goto('/branchenbuch')
    const backButton = freshPage.getByRole('button', { name: 'Zurück zur vorherigen Seite' })
    await expect(backButton).toBeVisible()
    await backButton.click()
    await freshPage.waitForURL('**/')
    await freshPage.close()
  })

  test('genau ein Zurück-Affordance auf /firma/[slug] (kein Duplikat neben dem bestehenden "Zurück zum Branchenbuch"-Link)', async ({ page }) => {
    const email = uniqueEmail('nav-firma')
    await registerSubunternehmer(page, { email, password: 'sicheres-passwort-123', companyName: 'Nav Test GmbH', gewerk: 'Trockenbau' })
    const userResult = await db().query('SELECT id, company_slug FROM users WHERE email = $1', [email])
    const userId = userResult.rows[0].id
    await db().query(
      `UPDATE users SET directory_listed = true, subscription_status = 'active', subscription_tier = 'monthly' WHERE id = $1`,
      [userId]
    )
    await page.goto('/branchenbuch')
    const slug = (await db().query('SELECT company_slug FROM users WHERE id = $1', [userId])).rows[0].company_slug
    expect(slug).toBeTruthy()

    await page.goto(`/firma/${slug}`)
    // Der zentrale Header-Zurück-Button (showBackButton=false auf dieser Seite) darf NICHT
    // zusätzlich zum bestehenden, seiteneigenen "Zurück zum Branchenbuch"-Link erscheinen.
    await expect(page.getByRole('button', { name: 'Zurück zur vorherigen Seite' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Zurück zum Branchenbuch' })).toHaveCount(1)
  })

  test('mobile Darstellung: Zurück-Button bleibt sichtbar und der Header bricht nicht um', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    // Auf Mobile ist die Desktop-Nav ausgeblendet – über das Menü öffnen.
    await page.getByLabel('Menü öffnen').click()
    await page.locator('#mobile-menu').getByRole('link', { name: 'Branchenbuch', exact: true }).click()
    await page.waitForURL('**/branchenbuch')
    const backButton = page.getByRole('button', { name: 'Zurück zur vorherigen Seite' })
    await expect(backButton).toBeVisible()
    // Der Header darf nicht umbrechen: Logo und Zurück-Button liegen weiterhin in derselben Zeile.
    const headerBox = await page.locator('header').first().boundingBox()
    const backButtonBox = await backButton.boundingBox()
    expect(headerBox).not.toBeNull()
    expect(backButtonBox).not.toBeNull()
    expect(backButtonBox!.y).toBeGreaterThanOrEqual(headerBox!.y)
    expect(backButtonBox!.y).toBeLessThan(headerBox!.y + headerBox!.height)
  })
})
