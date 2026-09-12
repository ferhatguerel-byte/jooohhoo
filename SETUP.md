# BAUVERSUS – Setup-Anleitung

## Was das Projekt ist

Eine Marktplatz-Plattform für Bau und Handwerk mit zwei Bereichen:

- **Privat-/Gewerbekunden ↔ Handwerksbetriebe**: Kunde beschreibt sein Projekt
  in Alltagssprache, eine KI erstellt daraus ein strukturiertes
  Leistungsverzeichnis (Positionen je Gewerk). Handwerksbetriebe geben
  Angebote je Position ab – dadurch werden Angebote direkt vergleichbar
  (Positions- und Gesamtpreis-Tabelle).
- **Bauunternehmen ↔ Nachunternehmer**: dieselbe Plattform, für die
  Vermittlung von Subunternehmern (z. B. für polnische Fachfirmen).

Beide Seiten nutzen dieselben Rollen: **Auftraggeber** (zahlt ein Abo,
stellt Aufträge ein) und **Anbieter/Subunternehmer** (kostenlos, gibt
Angebote ab).

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

## 4. Stripe einrichten (Zahlungen der Auftraggeber)

1. Account auf https://stripe.com erstellen
2. Drei Produkte mit wiederkehrender monatlicher Zahlung anlegen:
   Basic 49 €, Pro 149 €, Premium 399 €/Monat
3. Price-IDs als `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`,
   `STRIPE_PRICE_PREMIUM` eintragen
4. API-Key als `STRIPE_SECRET_KEY` eintragen
5. Webhook: `https://deine-domain.de/api/billing/webhook`,
   Events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → Signing Secret als
   `STRIPE_WEBHOOK_SECRET`

## 5. E-Mail-Benachrichtigungen (optional)

Account auf https://resend.com, `RESEND_API_KEY` und `FROM_EMAIL` eintragen.
Ohne diese Variablen werden Benachrichtigungen nur ins Server-Log
geschrieben (kein Absturz).

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
