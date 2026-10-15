import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { hashPassword, createSessionCookie } from '@/lib/auth'
import { GEWERKE } from '@/lib/gewerke'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-error'
import { readJsonBody } from '@/lib/security/request-limits'
import { CURRENT_TERMS_VERSION } from '@/lib/legal/terms-version'

// Phase 4.3 (Teil D): phone/plz/ort hatten keine Maximallänge.
// Rechtssicherheits-Fix: ohne nachweisbare Zustimmung zu AGB/Datenschutz bei Vertragsschluss war
// die Registrierung rechtlich angreifbar (kein Nachweis einer Einwilligung). acceptTerms muss
// serverseitig auf true geprüft werden – eine reine Client-Pflicht (HTML `required`) wäre ohne
// diese Prüfung umgehbar (direkter API-Aufruf ohne Checkbox).
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['auftraggeber', 'subunternehmer']),
  companyName: z.string().min(2).max(150),
  phone: z.string().max(30).optional(),
  plz: z.string().min(4).max(10),
  ort: z.string().min(2).max(100),
  gewerke: z.array(z.enum(GEWERKE)).optional(),
  acceptTerms: z.literal(true, {
    message: 'Bitte bestätigen Sie, dass Sie die AGB und die Datenschutzerklärung akzeptieren.',
  }),
})

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await readJsonBody(req))

    const allowed = await checkRateLimit('register', getClientIp(req), 8, 60)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Zu viele Registrierungen von dieser Verbindung. Bitte versuchen Sie es später erneut.' },
        { status: 429 }
      )
    }

    const db = getDb()

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [body.email])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Diese E-Mail-Adresse ist bereits registriert.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(body.password)
    const gewerke = body.role === 'subunternehmer' ? body.gewerke || [] : []

    // Phase 2E – Nachweis der AGB-/Datenschutz-Zustimmung: Zeitpunkt UND Versionskennung werden im
    // selben atomaren INSERT wie der restliche Nutzerdatensatz geschrieben, nicht in einem
    // separaten Folge-Query (kein Zeitfenster, in dem ein Nutzer ohne dokumentierte Zustimmung
    // existiert). `new Date()` ist intern immer UTC (epochbasiert); der pg-Treiber übermittelt den
    // Wert entsprechend als UTC-Zeitstempel, unabhängig von der Server-Zeitzone. Die Version
    // kommt ausschließlich aus der serverseitigen Konstante CURRENT_TERMS_VERSION – der Client
    // kann sie über den Request-Body nicht beeinflussen (registerSchema oben kennt kein
    // entsprechendes Feld, ein zusätzlich mitgesendetes Feld würde von Zod ignoriert).
    const termsAcceptedAt = new Date()

    const result = await db.query(
      `INSERT INTO users (email, password_hash, role, company_name, phone, plz, ort, gewerke, terms_accepted_at, terms_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, role`,
      [
        body.email,
        passwordHash,
        body.role,
        body.companyName,
        body.phone || null,
        body.plz,
        body.ort,
        gewerke,
        termsAcceptedAt,
        CURRENT_TERMS_VERSION,
      ]
    )

    const user = result.rows[0]
    await createSessionCookie({ userId: user.id, role: user.role })

    return NextResponse.json({ ok: true, role: user.role })
  } catch (err: unknown) {
    return handleApiError(err, 'Registrierung fehlgeschlagen.')
  }
}
