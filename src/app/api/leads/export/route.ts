import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filters = {
    status: searchParams.get('status') || 'alle',
    gewerk: searchParams.get('gewerk') || 'alle',
    search: searchParams.get('search') || '',
  }
  const leads = db.getLeads(filters)

  const cols = ['Firma', 'Ansprechpartner', 'E-Mail', 'Telefon', 'Website', 'Adresse', 'Stadt', 'Gewerk', 'Bewertung', 'Status', 'Quelle', 'E-Mail gesendet', 'Notizen', 'Erstellt']
  const rows = leads.map(l => [
    l.company_name, l.contact_name, l.email, l.phone, l.website, l.address, l.city, l.gewerk,
    l.rating, l.status, l.source, l.email_sent ? 'Ja' : 'Nein', l.notes, l.created_at,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`))

  const csv = [cols.map(c => `"${c}"`).join(','), ...rows.map(r => r.join(','))].join('\n')

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
