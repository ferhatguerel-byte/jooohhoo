import { test, expect } from '@playwright/test'
import path from 'node:path'
import { registerSubunternehmer, uniqueEmail } from './helpers'

// Diese Flows benötigen echten Zugriff auf Vercel Blob (BLOB_READ_WRITE_TOKEN), der in dieser
// Sandbox nicht verfügbar ist – siehe Abschlussbericht. Mit gesetztem Token laufen sie unverändert.
test.skip(!process.env.BLOB_READ_WRITE_TOKEN, 'BLOB_READ_WRITE_TOKEN nicht gesetzt – Upload/Datei-Zugriff kann hier nicht getestet werden.')

test.describe('Upload & Zugriff auf private Dateien', () => {
  test('ein Unternehmer kann einen Qualifikationsnachweis hochladen', async ({ page }) => {
    const email = uniqueEmail('upload-un')
    const password = 'sicheres-passwort-123'
    await registerSubunternehmer(page, { email, password, companyName: 'Upload Test GmbH', gewerk: 'Trockenbau' })

    await page.goto('/dashboard/profil')
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample.pdf'))
    await expect(page.getByText('sample.pdf')).toBeVisible()
  })

  test('der Uploader kann seine eigene private Datei über /api/files/[id] abrufen, ein fremder Nutzer nicht', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('fileowner')
    const password = 'sicheres-passwort-123'
    await registerSubunternehmer(page, { email, password, companyName: 'File Owner GmbH', gewerk: 'Trockenbau' })

    await page.goto('/dashboard/profil')
    await page.locator('input[type="file"]').first().setInputFiles(path.join(__dirname, 'fixtures', 'sample.pdf'))
    const link = page.getByRole('link', { name: /sample\.pdf/ }).first()
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/api\/files\//)

    const ownRes = await page.request.get(href!)
    expect(ownRes.status()).toBe(200)

    const strangerContext = await browser.newContext()
    const strangerPage = await strangerContext.newPage()
    const strangerEmail = uniqueEmail('stranger')
    await registerSubunternehmer(strangerPage, {
      email: strangerEmail,
      password,
      companyName: 'Stranger GmbH',
      gewerk: 'Trockenbau',
    })
    const strangerRes = await strangerPage.request.get(href!)
    expect(strangerRes.status()).toBe(403)
    await strangerContext.close()
  })
})
