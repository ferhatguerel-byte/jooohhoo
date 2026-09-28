import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireActiveUserApi } from '@/lib/authorization'
import { generateLeistungsverzeichnis } from '@/lib/ai'
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-error'

const schema = z.object({ description: z.string().min(20).max(4000) })

export async function POST(req: NextRequest) {
  try {
    // requireActiveUserApi(): ein gesperrtes/gelöschtes Konto darf über eine noch gültige Session
    // kein (kostenpflichtiges) KI-Leistungsverzeichnis mehr erzeugen – gehört zum selben, jetzt
    // gesperrten Job-Erstellungs-Workflow wie POST /api/jobs.
    const user = await requireActiveUserApi()
    if (user.role !== 'auftraggeber') {
      return NextResponse.json({ error: 'Nur Auftraggeber können ein Leistungsverzeichnis erstellen.' }, { status: 403 })
    }

    // Pro Nutzer und pro IP begrenzt, damit ein einzelner Account (oder Client) nicht
    // beliebig oft teure KI-Leistungsverzeichnisse erzeugen kann.
    await enforceRateLimit(
      'generate-lv:user',
      user.id,
      10,
      60,
      'Sie haben das Limit für KI-Leistungsverzeichnisse erreicht. Bitte versuchen Sie es in einer Stunde erneut.'
    )
    await enforceRateLimit('generate-lv:ip', getClientIp(req), 20, 60)

    const { description } = schema.parse(await req.json())
    const result = await generateLeistungsverzeichnis(description)
    return NextResponse.json(result)
  } catch (err: unknown) {
    return handleApiError(err, 'Leistungsverzeichnis konnte nicht erstellt werden.', req)
  }
}
