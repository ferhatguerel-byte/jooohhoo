import { getAppUrl } from '@/lib/url'

/**
 * Phase 4.1 – zentrale, sichere Serialisierung für JSON-LD, das per `dangerouslySetInnerHTML` in
 * ein `<script type="application/ld+json">`-Element eingebettet wird.
 *
 * `JSON.stringify()` escaped `<`, `>` und `&` NICHT. Enthält ein beliebiges JSON-LD-Feld (z.B. ein
 * user-generierter Firmenname) die Zeichenfolge `</script>`, bricht der Browser-HTML-Parser aus dem
 * Script-Element aus, BEVOR JavaScript den Inhalt überhaupt als JSON interpretiert – der danach
 * folgende Text wird als normales HTML geparst (Stored XSS, Phase-4.0-Audit-Fund). Die bestehende
 * CSP (`next.config.ts`, `script-src 'self' 'unsafe-inline'`) verhindert dies NICHT, da
 * `unsafe-inline` genau solche direkt eingebetteten Skripte erlaubt.
 *
 * Fix: Unicode-Escapes statt der literalen Zeichen – syntaktisch identisches, gültiges JSON
 * (`<` etc. werden beim Parsen zu genau demselben Zeichen), aber der rohe HTML-Text enthält
 * an keiner Stelle mehr `<`, `>` oder `&` – ein Ausbruch aus dem Script-Tag ist damit unmöglich,
 * unabhängig vom Inhalt des serialisierten Werts. Dies ist die EINZIGE Stelle im Repository, die
 * JSON für ein `<script>`-Element serialisieren darf – alle Aufrufstellen nutzen ausschließlich
 * diese Funktion (bzw. die `<JsonLd>`-Komponente unten), keine eigene Regex-Lösung pro Datei.
 */
export function toSafeJsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

/** BreadcrumbList-JSON-LD aus einer einfachen Pfad-Liste. Nur echte, tatsächlich existierende Pfade. */
export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  const base = getAppUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${base}${item.path}`,
    })),
  }
}

/**
 * Service-JSON-LD für eine Gewerk/Leistung-Landingpage. Bewusst OHNE aggregateRating/reviews –
 * diese werden nur eingefügt, wenn echte Bewertungsdaten vorhanden sind (siehe
 * buildAggregateRatingJsonLd), niemals erfunden (Phase-2 §11).
 */
export function buildServiceJsonLd(opts: {
  name: string
  description: string
  areaServed?: string
  providerCount?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    description: opts.description,
    provider: { '@type': 'Organization', name: 'BAUVERSUS' },
    ...(opts.areaServed ? { areaServed: { '@type': 'City', name: opts.areaServed } } : {}),
  }
}

/** Nur aufrufen, wenn reviewCount > 0 – sonst keine aggregateRating einbetten. */
export function buildAggregateRatingJsonLd(avgRating: number, reviewCount: number) {
  return {
    '@type': 'AggregateRating',
    ratingValue: avgRating,
    reviewCount,
  }
}
