import { describe, it, expect } from 'vitest'
import { publicProviderSqlCondition } from '@/lib/public-provider-eligibility'

/**
 * Reines SQL-Fragment – die eigentliche Wirkung wird an den Aufrufstellen (branchenbuch/page.tsx,
 * firma/[slug]/page.tsx, sitemap.ts, etc.) über echte Query-Assertions geprüft. Hier wird nur
 * geprüft, dass das Fragment selbst korrekt/konsistent aufgebaut ist und alle geforderten
 * Bedingungen enthält.
 */
describe('publicProviderSqlCondition', () => {
  it('enthält alle vier geforderten Bedingungen ohne Tabellen-Alias', () => {
    const sql = publicProviderSqlCondition()
    expect(sql).toContain("role = 'subunternehmer'")
    expect(sql).toContain("account_status = 'active'")
    expect(sql).toContain('directory_listed = true')
    expect(sql).toContain("subscription_status = 'active'")
  })

  it('schließt weder "suspended" noch "deleted" explizit als erlaubten Wert ein (Positivliste statt Negativliste)', () => {
    const sql = publicProviderSqlCondition()
    // Bewusst eine Positivliste ("account_status = 'active'") statt einer Negativliste
    // ("account_status != 'suspended' AND account_status != 'deleted'") – jeder zukünftige
    // dritte/vierte Status ist dadurch automatisch sicher (default-deny), nicht nur die beiden
    // heute bekannten Werte.
    expect(sql).not.toContain('suspended')
    expect(sql).not.toContain('deleted')
  })

  it('präfixt alle Spalten mit dem übergebenen Alias', () => {
    const sql = publicProviderSqlCondition('u')
    expect(sql).toBe(
      "u.role = 'subunternehmer' AND u.account_status = 'active' AND u.directory_listed = true AND u.subscription_status = 'active'"
    )
  })

  it('ohne Alias werden die Spalten unpräfixiert verwendet', () => {
    const sql = publicProviderSqlCondition()
    expect(sql).toBe(
      "role = 'subunternehmer' AND account_status = 'active' AND directory_listed = true AND subscription_status = 'active'"
    )
  })
})
