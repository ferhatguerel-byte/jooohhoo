# Phase 4.1 – Security + Legal-UX-Hardening

Dokumentiert die vier Fixes aus dem Phase-4.0-Launch-Readiness-Audit. Kein Konzeptwechsel bei
Matching/Score/Notifications/Analytics/Award-Flow – siehe jeweiliger bestehender Doku dazu.

## 1. Sichere JSON-LD-Serialisierung (Stored-XSS-Fix)

`JSON.stringify()` escaped `<`, `>` und `&` nicht. Ein per `dangerouslySetInnerHTML` in ein
`<script type="application/ld+json">`-Element eingebettetes Feld mit `</script>` im Wert (z.B.
ein Firmenname) konnte den Browser-HTML-Parser aus dem Script-Element ausbrechen lassen, bevor der
Inhalt überhaupt als JSON interpretiert wurde. Die CSP (`script-src 'self' 'unsafe-inline'` in
`next.config.ts`) verhindert dies nicht, da `unsafe-inline` genau solche inline eingebetteten
Skripte erlaubt.

**Fix:** `src/lib/seo/structured-data.ts` → `toSafeJsonLdString(data)`. Ersetzt `<`/`>`/`&` nach dem
`JSON.stringify()` durch Unicode-Escapes (`<` etc.) – syntaktisch identisches, gültiges JSON,
aber der rohe HTML-Text enthält an keiner Stelle mehr diese Zeichen. Ein Ausbruch aus dem
Script-Tag ist damit unabhängig vom Payload unmöglich.

**Einzige zulässige Einbettungsstelle:** `src/components/seo/JsonLd.tsx` (`<JsonLd data={...} />`).
Keine neue Aufrufstelle darf `JSON.stringify()` direkt in ein `dangerouslySetInnerHTML` schreiben –
alle bestehenden Stellen (`layout.tsx`, `firma/[slug]`, `ratgeber/[slug]`,
`BranchenbuchGewerkOrStadtPage`, `GewerkStadtLandingPage`) wurden migriert.

Tests: `tests/seo/json-ld-safety.test.ts` (10 Fälle, Unit) sowie `tests/e2e/legal-footer.spec.ts`
(Browser-DOM-Verifikation: injizierter `<script>`-Payload wird nicht ausgeführt).

## 2. Company-Name-Längenlimit

`z.string().min(2).max(150)` in `src/app/api/auth/register/route.ts` und
`src/app/api/profile/route.ts`. `company_name` ist eine `TEXT`-Spalte ohne DB-Constraint – keine
Migration nötig, reine Zod-Validierungsgrenze.

## 3. Globaler Footer (Erreichbarkeit der Rechtstexte)

`src/components/layout/SiteFooter.tsx` – zentraler Footer mit Links zu Impressum/Datenschutz/AGB/
Widerruf, eingebunden auf allen öffentlichen Seiten (Startseite, Branchenbuch, Handwerker/
Nachunternehmer/Leistungen/Baukosten inkl. Detailseiten, Ratgeber, Firma-Profil, Login,
Registrierung, Passwort-Reset-Flow, sowie den Rechtstextseiten selbst).

**Bewusst nicht** im Root-Layout oder in `/dashboard/*` eingebunden: das Dashboard hat ein eigenes,
App-artiges Layout ohne Footer-Slot; ein zusätzlicher Marketing-Footer dort passt nicht zur
bestehenden UX und wurde nicht erzwungen.

## 4. Widerruf-Seite (`/widerruf`)

Erfindet **keinen neuen Rechtstext**. Verweist ausschließlich auf die bereits bestehende,
freigegebene Position in `src/app/agb/page.tsx` (§ 3): Unternehmer-Abos setzen eine gewerbliche/
selbständige berufliche Tätigkeit voraus (§ 14 BGB), ein gesetzliches Verbraucherwiderrufsrecht
nach §§ 312g, 355 BGB besteht daher grundsätzlich nicht; die Auftraggeber-Nutzung ist gemäß § 2
kostenlos, es entsteht kein entgeltlicher Verbrauchervertrag. Ein zusätzlicher Hinweis auf der
Seite macht transparent, dass eine darüberhinausgehende Widerrufsbelehrung (falls je erforderlich)
vor Veröffentlichung eine eigene fachliche/rechtliche Freigabe benötigt.

## 5. Cookie-/Tracking-Consent – technischer Status (keine erfundene Policy)

Repo-weite Inventur (Grep über Cookies/`localStorage`/`sessionStorage`/`document.cookie`/
Stripe-Client-Skripte):

| Technologie | Fundstelle | Zweck |
|---|---|---|
| `bp24_session` Cookie (httpOnly) | `src/lib/auth.ts` | Technisch notwendige Login-Session (JWT) |
| First-Party-Analytics (`track()`) | `src/lib/analytics.ts`, `analytics_events`-Tabelle | Serverseitige Funnel-Metriken (Phase 3.6G), kein Cookie/`localStorage`, keine Drittanbieter-Übertragung |

Es existiert **kein** Marketing-/Tracking-Cookie, kein `localStorage`/`sessionStorage`-Einsatz und
kein eingebettetes Drittanbieter-Skript (Stripe läuft ausschließlich über redirect-basiertes
Hosted Checkout/Billing Portal, nicht über `@stripe/stripe-js`/Elements im Client).

**Diese Phase trifft keine eigene rechtliche Aussage darüber, ob und für welche der obigen
Technologien ein Consent-Banner erforderlich ist** – das ist eine Rechtsfrage, keine technische.
Es wurde **keine Consent-Policy und kein Consent-Banner implementiert**, da keine freigegebene
Konfiguration vorliegt. Die First-Party-Analytics aus Phase 3.6G bleibt unverändert aktiv (nicht
abgeschaltet). Diese Zeile ist der offene Punkt: *Consent-Anforderung für die Session-Cookie- und/
oder Analytics-Nutzung muss von rechtlicher/produktseitiger Stelle entschieden werden, bevor ggf.
ein Banner umgesetzt wird.*

## 6. File-Authorization – Subscription-Gate für `/api/files/[id]`

**Fund (Phase 4.0):** Ein Subunternehmer ohne aktives Abo konnte `job_attachment`-Dateien offener
Aufträge über `/api/files/[id]` direkt abrufen, obwohl `dashboard/jobs/page.tsx` die gesamte
Auftragsliste (und damit die Anhänge) nur bei aktivem Abo anzeigt (`hasActiveSub`) – ein
Paywall-Bypass über die bekannte fileId.

**Fix:** In `src/app/api/files/[id]/route.ts`, Zweig "offener Auftrag + Subunternehmer", zusätzlich
zur bisherigen Bedingung:

```
authorized =
  user.accountStatus === 'active' &&
  user.subscriptionStatus === 'active' &&
  !!user.subscriptionTier
```

Alle anderen Zweige der Zugriffsmatrix bleiben unverändert (Auftraggeber-eigener Auftrag, Admin,
eigene hochgeladene Datei, Angebots-Beziehung nach Auftragsschluss, `qualification_file`-Isolation).
`blockedGewerke`/Verifizierungsstatus werden bewusst **nicht** zusätzlich geprüft – diese schränken
laut bestehender UI nur die Angebotsabgabe ein, nicht die Sichtbarkeit der offenen Liste.

### Zugriffsmatrix `job_attachment` (Auszug, vollständig in `tests/routes/private-files.test.ts`)

| Nutzer | Auftragsstatus | Beziehung | Abo aktiv? | Zugriff |
|---|---|---|---|---|
| Auftraggeber (Eigentümer) | egal | eigener Auftrag | – | ✅ |
| Auftraggeber (fremd) | egal | kein Bezug | – | ❌ |
| Subunternehmer | offen | kein Angebot | ✅ aktiv | ✅ |
| Subunternehmer | offen | kein Angebot | ❌ inaktiv/`canceled`/`past_due`/kein Tier | ❌ (Fix) |
| Subunternehmer | offen | kein Angebot | ✅ aktiv, aber `account_status='suspended'` | ❌ (Fix) |
| Subunternehmer | geschlossen | eigenes Angebot vorhanden | – | ✅ |
| Subunternehmer | geschlossen | kein Angebot | – | ❌ |
| Admin | egal | egal | – | ✅ |
| beliebig | – | Datei existiert nicht | – | 404 (kein Leak, ob Datei existiert vs. kein Zugriff) |

Tests: `tests/routes/private-files.test.ts` (14 Fälle inkl. 4 neuer Phase-4.1-Fälle für den
Paywall-Bypass-Fix).

## Fehlerantworten

`/api/files/[id]` nutzt durchgängig `handleApiError` (siehe `src/lib/api-error.ts`) – keine
Blob-URLs, internen IDs, Stacktraces oder DB-Fehlermeldungen werden an den Client durchgereicht.
