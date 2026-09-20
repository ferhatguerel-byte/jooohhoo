import type { NextRequest } from 'next/server'

/**
 * Öffentliche App-URL ohne trailing slash, damit Pfade nie doppelte "/" bekommen.
 *
 * Auflösung:
 * 1. `NEXT_PUBLIC_APP_URL`, falls gesetzt – hat immer Vorrang.
 * 2. Ohne Env-Variable, aber mit `req` (z. B. in einem Route Handler): der tatsächliche
 *    Request-Host. Das ist sicher, weil es die Domain widerspiegelt, unter der die Anfrage
 *    tatsächlich einging (z. B. eine Vercel-Preview-URL), nie eine fest hinterlegte fremde Domain.
 * 3. Ohne Env-Variable und ohne `req` (z. B. beim Erzeugen von Metadata, Sitemap, E-Mails):
 *    in Entwicklung `http://localhost:3000`, in Production ein harter Fehler – damit kanonische
 *    URLs, Open-Graph-Tags, die Sitemap oder E-Mail-Links niemals still auf eine falsche oder
 *    nicht erreichbare Domain zeigen.
 */
export function getAppUrl(req?: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/+$/, '')

  if (req) return `${req.nextUrl.protocol}//${req.nextUrl.host}`

  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000'

  throw new Error(
    'NEXT_PUBLIC_APP_URL ist nicht gesetzt. In Production darf hierfür keine fest hinterlegte ' +
      'Domain als stiller Fallback verwendet werden. Bitte die Umgebungsvariable in den Vercel-Projekteinstellungen setzen.'
  )
}
