import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const text = await req.text()
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return NextResponse.json({ error: 'Leere Datei' }, { status: 400 })

  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  const imported: string[] = []

  for (const line of lines.slice(1)) {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',')
    const clean = (v: string) => v?.replace(/^"|"$/g, '').trim() || ''
    const get = (key: string) => clean(vals[header.indexOf(key)] || '')

    const company = get('firma') || get('company') || get('company_name') || get('unternehmen') || get('name')
    if (!company) continue

    db.createLead({
      company_name: company,
      contact_name: get('ansprechpartner') || get('contact_name') || get('kontakt'),
      email: get('e-mail') || get('email') || get('mail'),
      phone: get('telefon') || get('phone') || get('tel'),
      website: get('website') || get('webseite'),
      address: get('adresse') || get('address'),
      city: get('stadt') || get('city') || get('ort'),
      gewerk: get('gewerk') || get('branche') || get('kategorie'),
      notes: get('notizen') || get('notes'),
      source: 'csv_import',
      status: 'neu',
    })
    imported.push(company)
  }

  return NextResponse.json({ imported: imported.length })
}
