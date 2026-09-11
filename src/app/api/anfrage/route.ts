import { NextRequest, NextResponse } from 'next/server'
import { sendQuoteRequestEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { name, email, telefon, leistung, termin, nachricht } = await req.json()

    if (!name || !email || !leistung) {
      return NextResponse.json({ error: 'Name, E-Mail und Leistung sind erforderlich.' }, { status: 400 })
    }

    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
      await sendQuoteRequestEmail({ name, email, telefon, leistung, termin, nachricht })
    } else {
      console.log('Neue Angebotsanfrage:', { name, email, telefon, leistung, termin, nachricht })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('Anfrage Fehler:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
