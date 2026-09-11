# BauPartner24 – Setup-Anleitung

## Was das Projekt ist

Eine Marktplatz-Plattform, die deutsche Bauunternehmen (Auftraggeber) mit
polnischen Subunternehmern verbindet:

- Auftraggeber registrieren sich, wählen ein Abo (Basic/Pro/Premium) und
  stellen Bauaufträge ein
- Subunternehmer registrieren sich kostenlos, durchsuchen offene Aufträge
  nach Gewerk/Region und geben Angebote ab
- Auftraggeber schalten Subunternehmer-Kontakte im Rahmen ihres monatlichen
  Kontingents frei
- Abrechnung der Auftraggeber-Abos über Stripe

## 1. Datenbank einrichten (Postgres)

Empfehlung: Vercel Postgres oder Neon (beide kostenlos im Starter-Tier).

1. Im Vercel-Dashboard: Projekt → Storage → "Create Database" → Postgres
2. Die generierte `DATABASE_URL` in die Umgebungsvariablen übernehmen
3. Schema einspielen:

```bash
psql "$DATABASE_URL" -f src/lib/schema.sql
```

## 2. Session-Secret setzen

```bash
# Zufälligen String generieren, z. B.:
openssl rand -base64 32
```

Als `SESSION_SECRET` in die Umgebungsvariablen eintragen.

## 3. Stripe einrichten (Zahlungen der Auftraggeber)

1. Account auf https://stripe.com erstellen
2. Drei Produkte mit wiederkehrender monatlicher Zahlung anlegen:
   - Basic – 49 €/Monat
   - Pro – 149 €/Monat
   - Premium – 399 €/Monat
3. Die jeweiligen Price-IDs als `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO`,
   `STRIPE_PRICE_PREMIUM` eintragen
4. API-Key als `STRIPE_SECRET_KEY` eintragen
5. Webhook einrichten: Endpoint `https://deine-domain.de/api/billing/webhook`,
   Events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → Signing Secret als
   `STRIPE_WEBHOOK_SECRET` eintragen

## 4. Lokal testen

```bash
npm install
cp .env.example .env.local
# .env.local ausfüllen (lokale Postgres-DB reicht zum Testen)
npm run dev
```

## 5. Deployment (Vercel)

```bash
vercel --prod
```

Alle Umgebungsvariablen aus `.env.example` im Vercel-Dashboard eintragen.

## 6. Rechtliches – Checkliste vor Livegang

- [ ] Impressum mit echten Firmendaten
- [ ] Datenschutzerklärung DSGVO-konform, insb. Auftragsverarbeitungsverträge
      mit Hosting-/Zahlungsdienstleistern
- [ ] AGB juristisch geprüft (Vermittlungsplattform-Modell, Widerrufsrecht
      bei Abo-Abschluss, Haftungsausschluss)
- [ ] Prüfen, ob eine Gewerbeanmeldung/Erlaubnis für Vermittlungstätigkeit
      nötig ist
