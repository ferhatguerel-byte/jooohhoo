# BAUVERSUS – Setup-Anleitung

## Was das Projekt ist

Eine Marktplatz-Plattform für Bau und Handwerk mit zwei Bereichen:

- **Privat-/Gewerbekunden ↔ Handwerksbetriebe**: Kunde beschreibt sein Projekt
  in Alltagssprache, eine KI erstellt daraus ein strukturiertes
  Leistungsverzeichnis (Positionen je Gewerk). Handwerksbetriebe geben
  Angebote je Position ab – dadurch werden Angebote direkt vergleichbar
  (Positions- und Gesamtpreis-Tabelle).
- **Bauunternehmen ↔ Nachunternehmer**: dieselbe Plattform, für die
  Vermittlung von Nachunternehmern (z. B. für polnische Fachfirmen).

Beide Seiten nutzen dieselben Rollen: **Auftraggeber** (kostenlos, stellt
Aufträge ein) und **Unternehmer** (zahlt ein Abo, um Aufträge zu sehen,
zu kontaktieren und Angebote abzugeben).

## 1. Datenbank einrichten (Postgres)

1. Vercel-Dashboard → Projekt → Storage → "Create Database" → Postgres
2. `DATABASE_URL` wird automatisch gesetzt
3. Schema einspielen:

```bash
psql "$DATABASE_URL" -f src/lib/schema.sql
```

## 2. Session-Secret

```bash
openssl rand -base64 32
```
→ als `SESSION_SECRET` eintragen.

## 3. KI-Leistungsverzeichnis (Anthropic API)

1. Account auf https://console.anthropic.com erstellen
2. API-Key erstellen → als `ANTHROPIC_API_KEY` eintragen
3. Optional: `ANTHROPIC_MODEL` anpassen (Standard: `claude-haiku-4-5-20251001`,
   günstig und schnell genug für strukturierte Textextraktion)

**Ohne diesen Key** funktioniert die Plattform weiterhin – Auftraggeber können
dann nur "Ohne Leistungsverzeichnis veröffentlichen" wählen, die
KI-Funktion zeigt einen Fehler an.

## 4. Stripe einrichten (Zahlungen der Unternehmer)

1. Account auf https://stripe.com erstellen
2. Zwei Preise anlegen, **beide mit monatlicher Abrechnung** (das Jahrespaket
   wird nicht als Jahresbetrag im Voraus abgebucht, sondern monatlich – die
   Mindestlaufzeit von 12 Monaten wird von der App selbst verwaltet, nicht
   von Stripe):
   - Monatspaket: wiederkehrend monatlich, 119 €
   - Jahrespaket: wiederkehrend monatlich, 89 €
3. Price-IDs als `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` eintragen
4. Optional, aber empfohlen: unter Einstellungen → Kundenportal eine zweite
   Portal-Konfiguration ohne „Abo kündigen"-Option anlegen und deren ID als
   `STRIPE_PORTAL_CONFIGURATION_ID_LOCKED` eintragen. Nutzer im Jahrespaket
   sehen diese eingeschränkte Ansicht, solange ihre Mindestlaufzeit läuft
   (die App erkennt automatisch, ob die Mindestlaufzeit abgelaufen ist).
5. API-Key als `STRIPE_SECRET_KEY` eintragen
6. Webhook: `https://deine-domain.de/api/billing/webhook`,
   Events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → Signing Secret als
   `STRIPE_WEBHOOK_SECRET`

## 5. E-Mail-Benachrichtigungen (optional)

Account auf https://resend.com, `RESEND_API_KEY` und `FROM_EMAIL` eintragen.
Ohne diese Variablen werden Benachrichtigungen nur ins Server-Log
geschrieben (kein Absturz).

## 5b. Datei-Upload einrichten (Bilder/Dateien bei Aufträgen, Nachweise)

1. Vercel-Dashboard → Projekt → Storage → "Create Database" → **Blob**
2. Mit dem Projekt verbinden → `BLOB_READ_WRITE_TOKEN` wird automatisch gesetzt

**Ohne diesen Store** funktioniert die Plattform weiterhin, nur der
Datei-Upload (Auftragsbilder, Verifizierungsnachweise) zeigt einen Fehler.

## 5c. Verifizierung der Unternehmer

Unternehmer laden in ihrem Profil Nachweise hoch (Gewerbeanmeldung,
Meisterbrief/Qualifikationsnachweis, Haftpflichtversicherung). Der Status
wird dadurch auf "Prüfung läuft" gesetzt. Eine E-Mail-Adresse als
`ADMIN_EMAIL` eintragen – dieser Account sieht unter
`/dashboard/admin/verifizierungen` alle offenen Anfragen mit den
hochgeladenen Dateien und kann sie verifizieren oder ablehnen. Erst nach
Freigabe erscheint das "Verifiziert"-Abzeichen bei den Angeboten des
Unternehmers.

## 6. Lokal testen

```bash
npm install
cp .env.example .env.local
# .env.local ausfüllen (lokale Postgres-DB reicht zum Testen)
npm run dev
```

## 7. Deployment (Vercel)

```bash
vercel --prod
```

Alle Umgebungsvariablen aus `.env.example` im Vercel-Dashboard eintragen.

## 8. Rechtliches – Checkliste vor Livegang

- [ ] Impressum mit echten Firmendaten
- [ ] Datenschutzerklärung DSGVO-konform (u. a. Auftragsverarbeitung mit
      Anthropic, Stripe, Hosting-Anbieter)
- [ ] AGB juristisch geprüft (Vermittlungsplattform-Modell, KI-generierte
      Inhalte, Widerrufsrecht bei Abo-Abschluss, Haftungsausschluss)
- [ ] Prüfen, ob eine Gewerbeanmeldung/Erlaubnis für Vermittlungstätigkeit
      nötig ist
