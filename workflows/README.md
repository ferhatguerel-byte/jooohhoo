# n8n Workflow: Aufzugsfirma Lead-Agent

Fertiger n8n-Workflow auf Basis des Blueprints `Blueprint_Aufzugsfirma_Lead_Agent.docx`.
Automatisierte Leadgewinnung für Berlin + 50 km über den Apify Google Maps Scraper,
KI-Bewertung der Leads via OpenAI und Speicherung in Google Sheets.

## Datei

- `n8n-aufzugsfirma-lead-agent.json` — direkt in n8n importierbar
  (n8n → Workflows → Import from File).

## Ablauf

1. Schedule Trigger (täglich 08:00)
2. HTTP Request: Apify Google-Maps-Actor starten (Suchbegriffe siehe Sticky Note im Workflow)
3. Wait + Status-Polling, bis der Apify-Run abgeschlossen ist
4. HTTP Request: Datensätze aus dem Apify-Dataset abrufen
5. Split Out (je Firma)
6. Dubletten-Check gegen bereits vorhandene Zeilen in Google Sheets
7. OpenAI: Lead-Score + Zusammenfassung (nur für neue, nicht-doppelte Leads)
8. Google Sheets: Zeile anhängen
9. OpenAI: personalisierte Erstmail erstellen
10. Gmail-Versand (optional, standardmäßig deaktiviert)

## Nach dem Import einrichten

1. **Apify**: In beiden `HTTP: ...Apify...`-Nodes den Query-Parameter `token` von
   `DEIN_APIFY_TOKEN` auf deinen echten Apify-API-Token setzen. Verwendeter Actor:
   `compass~crawler-google-places` (Google Maps Scraper).
2. **OpenAI**: In beiden `HTTP: OpenAI ...`-Nodes den Header
   `Authorization: Bearer DEIN_OPENAI_API_KEY` mit deinem echten Key ersetzen.
3. **Google Sheets**: In allen drei Google-Sheets-Nodes eine OAuth2-Verbindung
   auswählen und `DEINE_GOOGLE_SHEET_ID` durch deine Tabellen-ID ersetzen (bzw.
   per Dropdown auswählen). Tabellenblatt-Name: `Leads`. Erwartete Spalten:
   `Firma, Website, Telefon, E-Mail, Adresse, Kategorie, Ansprechpartner,
   Lead-Score, Notiz, Status, Datum`.
4. **Gmail (optional)**: Node `Gmail: Versand (optional)` ist deaktiviert. Erst
   aktivieren, nachdem eine Gmail-Verbindung gesetzt und die generierten
   Mailtexte geprüft wurden. Alternativ durch einen Brevo-HTTP-Request ersetzen.
5. Workflow aktivieren.

Hinweise dazu stehen auch direkt als Sticky Notes im importierten Workflow.

## Bekannte Einschränkungen

- Google Maps liefert selten E-Mail-Adressen und keine Ansprechpartner-Namen —
  diese Felder bleiben ggf. leer und müssen manuell angereichert werden.
- Der Dubletten-Check liest den Sheet-Stand einmal zu Laufbeginn; Leads, die
  innerhalb desselben Laufs mehrfach vorkommen, werden dadurch nicht erkannt
  (Apify liefert pro Suchbegriff i. d. R. aber unterschiedliche Orte).
