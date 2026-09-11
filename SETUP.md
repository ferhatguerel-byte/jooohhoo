# RundumWerk24 – Setup-Anleitung

## Was das Projekt enthält

Eine Next.js-Homepage für einen deutschen Dienstleister (Umzüge, Transporte,
Reinigung, Bau/Renovierung):

- Landing Page mit Leistungen, Ablauf, Referenzen, FAQ
- Angebotsformular → `/api/anfrage` → E-Mail-Versand via Resend
- Impressum, Datenschutzerklärung, AGB (Platzhalter-Texte, siehe unten)
- `robots.ts` / `sitemap.ts` für SEO

## 1. Firmendaten eintragen

Bevor die Seite live geht, echte Angaben eintragen (aktuell Platzhalter):

- `src/app/impressum/page.tsx` – Firmenname, Adresse, Geschäftsführer, HRB-Nummer, USt-ID
- `src/app/datenschutz/page.tsx`, `src/app/agb/page.tsx`
- Telefon/E-Mail/Adresse in `src/app/page.tsx` (Header, Kontakt, Footer)
- `src/app/layout.tsx` – `SITE_URL`, Kontaktdaten im `localBusinessJsonLd`-Objekt

**Wichtig:** Impressum und Datenschutzerklärung vor dem Livegang von einem
Anwalt oder einem Generator (z. B. e-recht24.de) prüfen/erstellen lassen –
die aktuellen Texte sind nur ein Gerüst.

## 2. Domain

Empfehlung: **rundumwerk24.de** (Verfügbarkeit beim Registrar deiner Wahl
selbst final prüfen, z. B. bei INWX, Namecheap oder Checkdomain – aus dieser
Umgebung heraus ist kein Live-WHOIS-Check möglich).

## 3. E-Mail-Versand aktivieren (Resend)

1. Account auf https://resend.com erstellen, Domain verifizieren
2. API-Key holen
3. `.env.local` anlegen:

```
RESEND_API_KEY=re_...
FROM_EMAIL=anfrage@rundumwerk24.de
QUOTE_NOTIFY_EMAIL=deine-empfangsadresse@rundumwerk24.de
```

Ohne gesetzten `RESEND_API_KEY` wird jede Anfrage nur ins Server-Log
geschrieben (kein Versand, kein Absturz) – praktisch zum lokalen Testen.

## 4. Lokal testen

```bash
npm install
npm run dev
# → http://localhost:3000
```

## 5. Deployment (z. B. Vercel)

```bash
npm install -g vercel
vercel --prod
```

Umgebungsvariablen (`RESEND_API_KEY`, `FROM_EMAIL`, `QUOTE_NOTIFY_EMAIL`) im
Vercel-Dashboard eintragen, danach die Domain verbinden (Vercel → Domain
hinzufügen → DNS beim Registrar setzen).

## 6. Rechtliches – Checkliste vor Livegang

- [ ] Impressum mit echten Firmendaten (§ 5 TMG)
- [ ] Datenschutzerklärung DSGVO-konform (ggf. anpassen, falls Analytics/Cookies dazukommen)
- [ ] AGB juristisch geprüft
- [ ] Transport-/Betriebshaftpflichtversicherung tatsächlich vorhanden, falls in den Texten behauptet
- [ ] Google Business Profil anlegen (hilft massiv beim lokalen SEO)
