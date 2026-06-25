import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { leadId, leistungen, angebotsDatum, gueltigBis, absenderFirma, absenderName, absenderEmail, absenderTel } = await req.json()
  const lead = db.getLead(leadId)
  if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })

  const nr = `ANG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const totalNetto = leistungen.reduce((s: number, l: { menge: number; einzelpreis: number }) => s + (l.menge * l.einzelpreis), 0)
  const mwst = totalNetto * 0.19
  const totalBrutto = totalNetto + mwst

  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Angebot ${nr}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .logo { font-size: 22px; font-weight: bold; color: #1a3a5c; }
  .sender-info { text-align: right; color: #555; font-size: 12px; line-height: 1.6; }
  .recipient { margin-bottom: 30px; }
  .recipient h3 { font-size: 13px; color: #555; margin-bottom: 4px; }
  .title-area { margin-bottom: 24px; border-bottom: 2px solid #1a3a5c; padding-bottom: 12px; }
  .title-area h1 { font-size: 20px; color: #1a3a5c; }
  .meta { font-size: 12px; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #1a3a5c; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .total-area { margin-left: auto; width: 280px; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .total-row.final { font-weight: bold; font-size: 15px; border-top: 2px solid #1a3a5c; padding-top: 8px; margin-top: 4px; color: #1a3a5c; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
  .notice { margin-top: 20px; font-size: 12px; color: #555; line-height: 1.6; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">${absenderFirma || 'Ihre Firma'}</div>
    <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.6">
      ${absenderName || ''}<br>
      ${absenderEmail || ''}<br>
      ${absenderTel || ''}
    </div>
  </div>
  <div class="sender-info">
    Angebotsnummer: <strong>${nr}</strong><br>
    Datum: ${angebotsDatum || new Date().toLocaleDateString('de-DE')}<br>
    Gültig bis: ${gueltigBis || ''}
  </div>
</div>

<div class="recipient">
  <h3>Angebot für:</h3>
  <strong>${lead.company_name || ''}</strong><br>
  ${lead.contact_name ? lead.contact_name + '<br>' : ''}
  ${lead.address || lead.city || ''}<br>
  ${lead.email ? `E-Mail: ${lead.email}<br>` : ''}
</div>

<div class="title-area">
  <h1>Angebot ${nr}</h1>
  <div class="meta">Gewerk: ${lead.gewerk || '—'} · Erstellungsdatum: ${angebotsDatum || new Date().toLocaleDateString('de-DE')}</div>
</div>

<p style="margin-bottom:16px;line-height:1.6">
  Sehr geehrte${lead.contact_name ? 'r ' + lead.contact_name : ' Damen und Herren'},<br><br>
  vielen Dank für Ihr Interesse. Hiermit unterbreiten wir Ihnen folgendes Angebot:
</p>

<table>
  <thead>
    <tr>
      <th style="width:40px">Pos.</th>
      <th>Beschreibung</th>
      <th style="width:60px;text-align:right">Menge</th>
      <th style="width:60px">Einheit</th>
      <th style="width:90px;text-align:right">Einzelpreis</th>
      <th style="width:100px;text-align:right">Gesamtpreis</th>
    </tr>
  </thead>
  <tbody>
    ${leistungen.map((l: { bezeichnung: string; menge: number; einheit: string; einzelpreis: number }, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.bezeichnung}</td>
      <td style="text-align:right">${l.menge}</td>
      <td>${l.einheit || 'Stk.'}</td>
      <td style="text-align:right">${fmt(l.einzelpreis)}</td>
      <td style="text-align:right">${fmt(l.menge * l.einzelpreis)}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="total-area">
  <div class="total-row"><span>Nettobetrag:</span><span>${fmt(totalNetto)}</span></div>
  <div class="total-row"><span>MwSt. 19%:</span><span>${fmt(mwst)}</span></div>
  <div class="total-row final"><span>Gesamtbetrag:</span><span>${fmt(totalBrutto)}</span></div>
</div>

<div class="notice">
  Zahlungsbedingungen: 30 Tage netto nach Rechnungsdatum.<br>
  Ausführungszeitraum: Nach Auftragserteilung und Verfügbarkeit.<br>
  Alle Preise verstehen sich zzgl. der gesetzlichen Mehrwertsteuer.
</div>

<div class="footer">
  ${absenderFirma || ''} · ${absenderEmail || ''} · ${absenderTel || ''}
</div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
