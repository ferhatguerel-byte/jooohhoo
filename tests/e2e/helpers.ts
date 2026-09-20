import { Pool } from 'pg'
import { createHash } from 'crypto'
import type { Page } from '@playwright/test'

let pool: Pool | undefined

export function db(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL ist für die E2E-Tests nicht gesetzt.')
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
}

export async function registerAuftraggeber(page: Page, opts: { email: string; password: string; companyName: string }) {
  await page.goto('/registrieren')
  await page.getByLabel('Name / Firmenname *', { exact: true }).fill(opts.companyName)
  await page.getByLabel('E-Mail *', { exact: true }).fill(opts.email)
  await page.getByLabel('Passwort *', { exact: true }).fill(opts.password)
  await page.getByLabel('PLZ *', { exact: true }).fill('10115')
  await page.getByLabel('Ort *', { exact: true }).fill('Berlin')
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await page.waitForURL('**/dashboard**')
}

export async function registerSubunternehmer(
  page: Page,
  opts: { email: string; password: string; companyName: string; gewerk: string }
) {
  await page.goto('/registrieren?rolle=subunternehmer')
  await page.getByRole('button', { name: 'Ich bin Unternehmer', exact: true }).click()
  await page.getByLabel('Firmenname *', { exact: true }).fill(opts.companyName)
  await page.getByLabel('E-Mail *', { exact: true }).fill(opts.email)
  await page.getByLabel('Passwort *', { exact: true }).fill(opts.password)
  await page.getByLabel('PLZ *', { exact: true }).fill('10115')
  await page.getByLabel('Ort *', { exact: true }).fill('Berlin')
  await page.getByRole('button', { name: opts.gewerk, exact: true }).click()
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click()
  await page.waitForURL('**/dashboard**')
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail', { exact: true }).fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.waitForURL('**/dashboard**')
}

export async function logout(page: Page, companyName: string) {
  // AccountMenu: Klick auf den Firmennamen öffnet das Dropdown, darin liegt "Abmelden".
  await page.getByRole('button', { name: companyName, exact: true }).click()
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
  await page.waitForURL('**/')
}

/** Aktiviert ein Abo direkt in der DB – umgeht bewusst Stripe, da Billing nicht Teil dieser E2E-Flows ist. */
export async function activateSubscription(email: string, tier: 'monthly' | 'yearly' = 'monthly') {
  await db().query(
    `UPDATE users SET subscription_status = 'active', subscription_tier = $2 WHERE email = $1`,
    [email, tier]
  )
}

/** Erstellt einen gültigen, noch nicht verwendeten Passwort-Reset-Token direkt in der DB
 *  (umgeht den E-Mail-Versand, der in dieser Sandbox ohne echten Resend-Key nicht beobachtbar ist). */
export async function seedResetToken(email: string): Promise<string> {
  const userResult = await db().query('SELECT id FROM users WHERE email = $1', [email])
  const userId = userResult.rows[0].id
  const token = `e2e-${Math.random().toString(36).slice(2)}-${Date.now()}`
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db().query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`,
    [userId, tokenHash]
  )
  return token
}

export async function closeDb() {
  if (pool) await pool.end()
}

/**
 * Setzt die Rate-Limit-Zähler zurück. Die E2E-Suite registriert in kurzer Zeit deutlich mehr
 * Nutzer von derselben lokalen IP, als das Registrierungs-Limit (siehe rate-limit.test.ts)
 * normalerweise zulässt – ohne diesen Reset würden spätere Tests fälschlich an der (korrekt
 * funktionierenden) Rate-Limitierung scheitern statt am eigentlich zu testenden Verhalten.
 */
export async function resetRateLimits() {
  await db().query('DELETE FROM rate_limit_hits')
}
