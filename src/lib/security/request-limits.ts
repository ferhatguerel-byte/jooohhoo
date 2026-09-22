import type { NextRequest } from 'next/server'

/** Von `handleApiError` (src/lib/api-error.ts) in eine 413-Antwort übersetzt. */
export class PayloadTooLargeError extends Error {
  constructor(message = 'Die Anfrage ist zu groß.') {
    super(message)
    this.name = 'PayloadTooLargeError'
  }
}

/**
 * Phase 4.3 (Teil C) – Next.js Route Handler haben (anders als Server Actions mit
 * `bodySizeLimit`) keine eingebaute, konfigurierbare Grenze für die Größe eines
 * `request.json()`-Bodys. Ein Angreifer könnte sonst ein beliebig großes JSON-Payload an einen
 * Endpunkt senden, der es vollständig einliest und parst, bevor überhaupt eine
 * Zod-Validierung greift – unnötiger Speicher-/CPU-Verbrauch (Teil C, "übergroße
 * Request-Payloads").
 *
 * `readJsonBody()` ersetzt `await req.json()` an Stellen mit nutzergeneriertem Freitext
 * (Jobs, Angebote, Nachrichten, Support-Tickets, Profil, Registrierung, Ratgeber-Artikel).
 * Prüft zuerst den `Content-Length`-Header (schneller Ausschluss ohne den Body überhaupt zu
 * lesen, falls der Client ihn korrekt setzt), danach zusätzlich die tatsächliche Byte-Länge
 * des gelesenen Texts (ein Client könnte `Content-Length` weglassen oder falsch angeben).
 *
 * `maxBytes` Default 100 KB – großzügig für jedes reale Formular dieser App (das größte Freitext-
 * Feld ist `support_tickets.message` mit 4000 Zeichen ≈ 16 KB im ungünstigsten UTF-8-Fall), aber
 * weit unter einem missbräuchlichen Multi-MB-Payload.
 */
export async function readJsonBody<T = unknown>(req: NextRequest, maxBytes = 100_000): Promise<T> {
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new PayloadTooLargeError()
  }

  const text = await req.text()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new PayloadTooLargeError()
  }

  return JSON.parse(text) as T
}
