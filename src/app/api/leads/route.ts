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
  const stats = db.getLeadStats()
  return NextResponse.json({ leads, stats })
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  const id = db.createLead(data)
  return NextResponse.json({ id }, { status: 201 })
}

export async function DELETE() {
  db.deleteAllLeads()
  return NextResponse.json({ ok: true })
}
