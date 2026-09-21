import { toSafeJsonLdString } from '@/lib/seo/structured-data'

/**
 * Phase 4.1 – einziger Weg, JSON-LD in die Seite einzubetten. Nutzt ausschließlich die zentrale,
 * sichere Serialisierung (`toSafeJsonLdString`) – siehe deren Kommentar in
 * src/lib/seo/structured-data.ts für die Begründung. Keine Aufrufstelle darf `JSON.stringify()`
 * direkt in ein `dangerouslySetInnerHTML` für ein `<script type="application/ld+json">` schreiben.
 */
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toSafeJsonLdString(data) }} />
}
