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
CJ_API_EMAIL=deine-cj-dropshipping-email@example.com
CJ_API_KEY=dein-cj-dropshipping-api-key
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

## Hunde-Komfort-Shop (Pawlenza)

Zusätzlich zum SaaS-Teil gibt es jetzt einen eigenen Produkt-Shop unter `/collections/hunde-komfort`
(Nische: orthopädische Hundebetten + Enrichment-Spielzeug — hohe emotionale Kaufbereitschaft,
gute Margen, TikTok-taugliche Reaktionsvideos). Der Shop läuft als eigener Bereich der App und
teilt sich Stripe/DB mit dem Rest des Projekts.

Sortiment (Anker + Verbrauch + Impuls), alle 6 Produkte mit echten CJ-Dropshipping-Produkt-IDs
verknüpft (Herkunft/Preis/Bestellzahlen je Produkt im `cjMatch`-Feld in `src/lib/products.ts`
dokumentiert):
- **Anker**: Hundebett mit gepolstertem Kissen M/L (dasselbe CJ-Produkt, zwei Größen)
- **Verbrauch/Zubehör**: Hundeschnüffelkissen, interaktiver Futterpuzzle-Spender (Enten-Design)
- **Impuls**: Automatischer Bewegungsball (ursprünglich Katzenspielzeug, funktioniert auch für
  kleine/verspielte Hunde), Hundekotbeutel-Vorteilspack (750 Stück)

**Noch offen:** Alle `supplierProductId`-Felder sind mit echten CJ-PIDs befüllt, die
`supplierVariantId`-Felder sind aber noch `CJ-PENDING-*-VID`-Platzhalter — die genaue
Varianten-ID (z.B. für eine bestimmte Größe/Farbe) steht erst, wenn man auf der jeweiligen
CJ-Produktseite die gewünschte Variante auswählt. Ohne echte Variant-ID kann die CJ-API beim
Bestellen einen Fehler zurückgeben (Order landet dann mit `supplier_status='failed'` in der DB,
sichtbar im Admin-Dashboard) — für den Mock-Modus (ohne API-Keys) spielt das keine Rolle.

- Produktkatalog: `src/lib/products.ts` (Preise, Beschreibungen, Bilder-Icons anpassen)
- Kollektionsseite: `/collections/hunde-komfort`
- Produktseite: `/products/[slug]`
- Warenkorb: `/cart` (lokal im Browser gespeichert)
- Checkout: `/api/shop/checkout` → erstellt eine Stripe-Checkout-Session mit Versandadress-Erfassung

### Lieferanten-Kopplung (CJ Dropshipping)

Sobald eine Bestellung bezahlt ist, verarbeitet der Webhook (`/api/webhook`) die Bestellung:
1. Legt die Order + Positionen in der DB an (`orders` / `order_items`)
2. Übergibt die Bestellung automatisch an CJ Dropshipping (`src/lib/suppliers/cjdropshipping.ts`)
3. Speichert Lieferanten-Status (`forwarded` / `mock_forwarded` / `failed`) an der Order

**Ohne `CJ_API_EMAIL` / `CJ_API_KEY`** läuft die Anbindung automatisch im **Mock-Modus** — Bestellungen
werden simuliert und im Server-Log ausgegeben (`[CJ Dropshipping MOCK] ...`), nichts wird wirklich
bestellt. Sobald du ein CJ-Dropshipping-Konto hast:

1. Account erstellen: https://cjdropshipping.com
2. Auf jeder der 6 Produktseiten (Links siehe `cjMatch`-Feld in `src/lib/products.ts`) die
   gewünschte Variante (Größe/Farbe) auswählen und die dortige Varianten-ID in
   `supplierVariantId` eintragen (`supplierProductId` ist bereits befüllt)
3. `CJ_API_EMAIL` und `CJ_API_KEY` in `.env.local` (und in Vercel) eintragen
4. Ab dann bestellt der Webhook automatisch live bei CJ Dropshipping, inkl. Versand an die vom
   Kunden im Stripe-Checkout erfasste Adresse

Andere Lieferanten (z.B. Spocket) lassen sich anbinden, indem du `src/lib/suppliers/types.ts`
implementierst und in `src/lib/suppliers/index.ts` als `activeSupplier` einträgst.

### Admin-Dashboard

Unter `/dashboard` (Passwort = `ADMIN_SECRET`) gibt es jetzt neben den SaaS-Kennzahlen auch einen
Block **"Shop-Bestellungen"**: Anzahl Bestellungen, Umsatz, Aufschlüsselung nach
Lieferanten-Status (`pending` / `forwarded` / `mock_forwarded` / `failed`) und eine Liste der
letzten 10 Bestellungen. Damit siehst du sofort, ob eine Bestellung erfolgreich an CJ
weitergeleitet wurde oder fehlgeschlagen ist.

### Go-Live-Checkliste

Der Code ist vollständig fertig und getestet (Build, Typecheck, End-to-End-Test der
Bestell-Pipeline lokal durchgeführt). Es fehlen nur noch Zugangsdaten/Accounts, die nur du
anlegen kannst:

- [ ] Echte Stripe-Keys in `.env.local` eintragen (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`)
- [ ] Stripe-Webhook einrichten und `STRIPE_WEBHOOK_SECRET` eintragen
- [ ] CJ-Dropshipping-Varianten-IDs für die 6 Produkte ergänzen (siehe oben)
- [ ] `CJ_API_EMAIL` / `CJ_API_KEY` bereits eingetragen — vor dem Live-Gang im CJ-Dashboard
      sicherheitshalber neu generieren, da die Werte im Chat-Verlauf sichtbar waren
- [ ] `npx prisma generate && npx prisma db push` bzw. DB-Datei einmal initialisieren
      (passiert automatisch beim ersten Request, siehe `src/lib/db.ts`)
- [ ] `vercel --prod` deployen, alle `.env.local`-Werte ins Vercel-Dashboard übertragen
- [ ] `NEXT_PUBLIC_APP_URL` auf die echte Domain setzen (wichtig für Stripe-Redirects nach
      dem Checkout)

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
