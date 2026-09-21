import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { GEWERKE, isMeisterpflichtig } from '@/lib/gewerke'
import { handleApiError } from '@/lib/api-error'

const qualificationFileSchema = z.object({
  fileId: z.string().uuid(),
  name: z.string().max(255),
  label: z.string().max(100),
})

// Phase 3.2: rein optionale Matching-Präferenzen des Unternehmers, noch ohne Matching-Logik.
// NULL/fehlend = "keine Angabe" – wird serverseitig nie in eine Zahl umgedeutet.
// Obergrenzen sind bewusste Plausibilitätsgrenzen (keine reale Fachgrenze):
// 1000 km deckt jeden denkbaren Einsatzradius innerhalb Deutschlands plus Grenzregionen ab,
// 100 Mio. € begrenzt absurde/versehentliche Eingaben, ohne reale Großprojekte auszuschließen.
const MAX_SERVICE_RADIUS_KM = 1000
const MAX_PROJECT_SIZE_EUR = 100_000_000

const profileSchema = z
  .object({
    companyName: z.string().min(2),
    phone: z.string().optional(),
    plz: z.string().min(4),
    ort: z.string().min(2),
    gewerke: z.array(z.enum(GEWERKE)).optional(),
    qualificationFiles: z.array(qualificationFileSchema).optional(),
    serviceRadiusKm: z.number().int().min(1).max(MAX_SERVICE_RADIUS_KM).nullable().optional(),
    minProjectSize: z.number().int().min(0).max(MAX_PROJECT_SIZE_EUR).nullable().optional(),
    maxProjectSize: z.number().int().min(0).max(MAX_PROJECT_SIZE_EUR).nullable().optional(),
  })
  .refine(
    (data) =>
      data.minProjectSize == null || data.maxProjectSize == null || data.minProjectSize <= data.maxProjectSize,
    { message: 'Die minimale Projektgröße darf nicht größer als die maximale sein.', path: ['minProjectSize'] }
  )

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  try {
    const body = profileSchema.parse(await req.json())
    let gewerke = user.role === 'subunternehmer' ? body.gewerke || [] : []

    if (user.role === 'subunternehmer' && user.verificationStatus !== 'verified') {
      gewerke = gewerke.filter((g) => !isMeisterpflichtig(g))
    }
    if (user.role === 'subunternehmer') {
      gewerke = gewerke.filter((g) => !user.blockedGewerke.includes(g))
    }
    const qualificationFiles = user.role === 'subunternehmer' ? body.qualificationFiles || [] : []

    // Mass-Assignment-Schutz: Matching-Präferenzen gelten nur für Unternehmer. Ein Auftraggeber
    // kann diese Felder nicht setzen, selbst wenn er sie im Request-Body mitschickt – analog zur
    // bestehenden Behandlung von gewerke/qualificationFiles oben.
    const serviceRadiusKm = user.role === 'subunternehmer' ? body.serviceRadiusKm ?? null : null
    const minProjectSize = user.role === 'subunternehmer' ? body.minProjectSize ?? null : null
    const maxProjectSize = user.role === 'subunternehmer' ? body.maxProjectSize ?? null : null

    const filesChanged =
      JSON.stringify([...qualificationFiles].sort((a, b) => a.fileId.localeCompare(b.fileId))) !==
      JSON.stringify([...user.qualificationFiles].sort((a, b) => a.fileId.localeCompare(b.fileId)))

    if (user.role === 'subunternehmer' && qualificationFiles.length > 0 && filesChanged) {
      const db = getDb()
      // Nur eigene, tatsächlich als Qualifikationsnachweis hochgeladene Dateien akzeptieren –
      // verhindert, dass ein Nutzer die fileId einer fremden Datei oder eines Auftrags-Anhangs
      // in sein eigenes Profil einträgt.
      const ownedFiles = await db.query(
        `SELECT id FROM private_files WHERE id = ANY($1::uuid[]) AND uploaded_by = $2 AND purpose = 'qualification_file'`,
        [qualificationFiles.map((f) => f.fileId), user.id]
      )
      if (ownedFiles.rows.length !== qualificationFiles.length) {
        return NextResponse.json({ error: 'Eine der Dateien konnte Ihrem Konto nicht zugeordnet werden.' }, { status: 400 })
      }

      await db.query(
        `UPDATE users SET company_name = $1, phone = $2, plz = $3, ort = $4, gewerke = $5,
         qualification_files = $6, verification_status = 'pending',
         service_radius_km = $7, min_project_size = $8, max_project_size = $9 WHERE id = $10`,
        [
          body.companyName,
          body.phone || null,
          body.plz,
          body.ort,
          gewerke,
          JSON.stringify(qualificationFiles),
          serviceRadiusKm,
          minProjectSize,
          maxProjectSize,
          user.id,
        ]
      )
    } else {
      await getDb().query(
        `UPDATE users SET company_name = $1, phone = $2, plz = $3, ort = $4, gewerke = $5,
         service_radius_km = $6, min_project_size = $7, max_project_size = $8 WHERE id = $9`,
        [body.companyName, body.phone || null, body.plz, body.ort, gewerke, serviceRadiusKm, minProjectSize, maxProjectSize, user.id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Profil konnte nicht gespeichert werden.')
  }
}
