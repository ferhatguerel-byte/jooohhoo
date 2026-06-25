import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Nicht konfiguriert' }, { status: 503 })
}
