import { describe, it, expect } from 'vitest'
import { toSafeJsonLdString } from '@/lib/seo/structured-data'

/**
 * Phase 4.1 – Stored-XSS-Fix (Phase-4.0-Audit-Fund): `JSON.stringify()` escaped `</script>` nicht,
 * ein Firmenname wie `Test</script><script>alert(1)</script>` konnte aus dem JSON-LD-Script-Tag
 * ausbrechen. `toSafeJsonLdString()` ersetzt `<`/`>`/`&` durch Unicode-Escapes – syntaktisch
 * identisches, gültiges JSON, aber der rohe HTML-Text enthält an keiner Stelle mehr diese Zeichen.
 */
describe('toSafeJsonLdString — Phase 4.1 Stored-XSS-Fix', () => {
  it('1. `</script>` wird sicher serialisiert (kein rohes "</script>" im Ausgabe-String)', () => {
    const out = toSafeJsonLdString({ name: 'Test</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<script>')
  })

  it('2. Das injizierte "<script>" wird nicht als HTML-Tag interpretiert (kein rohes "<" im Output)', () => {
    const out = toSafeJsonLdString({ name: '</script><img src=x onerror=alert(1)>' })
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
  })

  it('3. `&` wird sicher behandelt (kein rohes "&" im Output, das mit HTML-Entities kollidieren könnte)', () => {
    const out = toSafeJsonLdString({ name: 'A & B GmbH' })
    expect(out).not.toContain('&')
    expect(out).toContain('\\u0026')
  })

  it('4. normale Firmennamen bleiben korrekt (Roundtrip liefert exakt denselben String)', () => {
    const input = { name: 'Mustermann Bau GmbH' }
    const out = toSafeJsonLdString(input)
    expect(JSON.parse(out)).toEqual(input)
  })

  it('5. Umlaute bleiben korrekt (Roundtrip liefert exakt denselben String)', () => {
    const input = { name: 'Müller & Söhne Bauunternehmung GbR – Größe: groß' }
    const out = toSafeJsonLdString(input)
    expect(JSON.parse(out)).toEqual(input)
  })

  it('6. Anführungszeichen bleiben korrekt (Roundtrip liefert exakt denselben String)', () => {
    const input = { name: 'Firma "Der Meister" GmbH' }
    const out = toSafeJsonLdString(input)
    expect(JSON.parse(out)).toEqual(input)
  })

  it('7. JSON-LD bleibt syntaktisch gültig für alle Test-Payloads (JSON.parse wirft nie)', () => {
    const payloads = [
      'Test</script><script>alert(1)</script>',
      '</script><img src=x onerror=alert(1)>',
      `"&<>'`,
      'normaler Firmenname',
      'Müller & Söhne',
      'Firma "Der Meister"',
    ]
    for (const name of payloads) {
      const out = toSafeJsonLdString({ '@type': 'LocalBusiness', name })
      expect(() => JSON.parse(out)).not.toThrow()
      expect(JSON.parse(out)).toEqual({ '@type': 'LocalBusiness', name })
    }
  })

  it('8. XSS-Payload kann nicht aus dem Script-Element ausbrechen (kein "<"/">"/"&" irgendwo im rohen Output)', () => {
    const payloads = [
      'Test</script><script>alert(1)</script>',
      '</script><img src=x onerror=alert(1)>',
      `"&<>'`,
    ]
    for (const name of payloads) {
      const out = toSafeJsonLdString({ name, breadcrumb: [{ name, item: `https://example.com/${name}` }] })
      expect(out).not.toMatch(/[<>&]/)
    }
  })

  it('verschachtelte Objekte/Arrays werden vollständig escaped, nicht nur die oberste Ebene', () => {
    const out = toSafeJsonLdString({
      itemListElement: [{ name: 'A</script>', item: 'https://x.test/?a=1&b=2' }],
    })
    expect(out).not.toMatch(/[<>&]/)
    expect(JSON.parse(out)).toEqual({
      itemListElement: [{ name: 'A</script>', item: 'https://x.test/?a=1&b=2' }],
    })
  })

  it('leere/einfache Payloads ohne Sonderzeichen bleiben unverändert lesbar', () => {
    const out = toSafeJsonLdString({ '@context': 'https://schema.org', '@type': 'Organization' })
    expect(out).toContain('schema.org')
    expect(JSON.parse(out)).toEqual({ '@context': 'https://schema.org', '@type': 'Organization' })
  })
})
