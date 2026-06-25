# AutoBusiness Pro - Setup Anleitung

## Was du bekommst

Ein vollautomatisiertes SaaS-Business mit:
- **Landing Page** mit Verkaufstexten und 3 Preisplänen
- **Stripe Integration** für automatische Zahlungen (Kreditkarte + SEPA)
- **Affiliate System** - andere verkaufen für dich, 30% Provision automatisch
- **E-Mail Automatisierung** - Welcome, Bestätigung, Affiliate-Benachrichtigung
- **Admin Dashboard** - Echtzeit Umsatz, Kunden, Charts
- **Datenbank** - alle Kunden, Käufe, Provisionen gespeichert

## Schritt-für-Schritt Setup (ca. 2 Stunden)

### 1. Accounts erstellen (kostenlos)

- **Stripe**: https://stripe.com → Account erstellen → API Keys holen
- **Resend**: https://resend.com → Account erstellen → API Key holen → Domain verifizieren
- **Vercel**: https://vercel.com → Account erstellen (kostenloses Hosting)

### 2. Stripe Produkte anlegen

Im Stripe Dashboard:
1. Produkte → Neues Produkt
2. "Starter" → €29/Monat wiederkehrend → Price ID kopieren
3. "Pro" → €79/Monat wiederkehrend → Price ID kopieren
4. "Enterprise" → €199/Monat wiederkehrend → Price ID kopieren

### 3. .env.local ausfüllen

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@deinedomain.de
NEXT_PUBLIC_APP_URL=https://deinedomain.de
ADMIN_SECRET=waehle-ein-starkes-passwort
DATABASE_URL="file:./dev.db"
```

### 4. Datenbank initialisieren

```bash
npx prisma generate
npx prisma db push
```

### 5. Lokal testen

```bash
npm run dev
# → http://localhost:3000
```

### 6. Stripe Webhook einrichten (für automatische Verarbeitung)

```bash
# Stripe CLI installieren und testen:
stripe listen --forward-to localhost:3000/api/webhook
```

Im Stripe Dashboard:
- Webhooks → Endpoint hinzufügen
- URL: `https://deinedomain.de/api/webhook`
- Events: `checkout.session.completed`, `customer.subscription.deleted`

### 7. Auf Vercel deployen

```bash
npm install -g vercel
vercel --prod
```

Alle .env Variablen in Vercel Dashboard eintragen.

### 8. Domain verbinden

In Vercel → Domain hinzufügen → DNS bei deinem Registrar setzen

## Wie du €500/Tag erreichst

### Rechenbeispiel
- 7 Pro-Kunden (€79/Monat) = €553/Monat ≈ €18/Tag
- **Für €500/Tag brauchst du ~190 aktive Pro-Kunden**

### Strategie

1. **Affiliate Marketing starten** (0€ Kosten)
   - Deinen Affiliate-Link in Facebook-Gruppen teilen
   - YouTube Video über das Tool machen
   - Reddit Posts in relevanten Subreddits

2. **SEO Content** (0€ Kosten, Zeit: 2-3 Monate)
   - Blog-Artikel über Business-Automatisierung schreiben
   - Keywords: "business automatisieren", "passive einnahmen online"

3. **Paid Ads** (Budget nötig)
   - Facebook/Instagram Ads: €5-10/Tag Budget
   - Google Ads auf Keywords wie "business software"
   - Erwarteter CAC: €20-50 pro Kunde

4. **Cold Outreach**
   - LinkedIn Nachrichten an Unternehmer
   - E-Mail Kampagnen mit kostenlosem Trial

### Monatliches Wachstumsziel

| Monat | Kunden | MRR | Tages-Ø |
|-------|--------|-----|---------|
| 1     | 10     | €790 | €26 |
| 3     | 50     | €3.950 | €130 |
| 6     | 150    | €11.850 | €395 |
| 12    | 250    | €19.750 | €658 |

## Admin Dashboard

Gehe zu: `https://deinedomain.de/dashboard`
Passwort: das was du in ADMIN_SECRET gesetzt hast

Siehst du:
- Tagesumsatz
- Gesamtumsatz
- Kundenanzahl
- Umsatz-Chart
- Fortschrittsbalken zur €500/Tag Ziel

## Wichtig: Rechtliches

Du brauchst noch:
- **Impressum** (`/impressum`)
- **Datenschutzerklärung** (`/datenschutz`) - DSGVO-konform
- **AGB** (`/agb`)
- Steuerberater für die Einnahmen

Nutze Generator-Tools wie: https://www.e-recht24.de/muster-datenschutzerklaerung.html
