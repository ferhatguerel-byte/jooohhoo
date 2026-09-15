import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/current-user'
import { generateLeistungsverzeichnis } from '@/lib/ai'

const schema = z.object({ description: z.string().min(20).max(4000) })

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'auftraggeber') {
    return NextResponse.json({ error: 'Nur Auftraggeber können ein Leistungsverzeichnis erstellen.' }, { status: 403 })
  }

  try {
    const { description } = schema.parse(await req.json())
    const result = await generateLeistungsverzeichnis(description)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || 'Ungültige Eingabe.' }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Leistungsverzeichnis Fehler:', message)
    return NextResponse.json({ error: 'Leistungsverzeichnis konnte nicht erstellt werden.' }, { status: 500 })
  }
}
