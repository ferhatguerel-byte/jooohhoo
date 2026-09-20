import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/lib/current-user'
import { GEWERKE, isMeisterpflichtig } from '@/lib/gewerke'
import { handleApiError } from '@/lib/api-error'

const qualificationFileSchema = z.object({
  url: z.string().url(),
  name: z.string().max(255),
  label: z.string().max(100),
})

const profileSchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().optional(),
  plz: z.string().min(4),
  ort: z.string().min(2),
  gewerke: z.array(z.enum(GEWERKE)).optional(),
  qualificationFiles: z.array(qualificationFileSchema).optional(),
})

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

    const filesChanged =
      JSON.stringify([...qualificationFiles].sort((a, b) => a.url.localeCompare(b.url))) !==
      JSON.stringify([...user.qualificationFiles].sort((a, b) => a.url.localeCompare(b.url)))

    if (user.role === 'subunternehmer' && qualificationFiles.length > 0 && filesChanged) {
      await getDb().query(
        `UPDATE users SET company_name = $1, phone = $2, plz = $3, ort = $4, gewerke = $5,
         qualification_files = $6, verification_status = 'pending' WHERE id = $7`,
        [body.companyName, body.phone || null, body.plz, body.ort, gewerke, JSON.stringify(qualificationFiles), user.id]
      )
    } else {
      await getDb().query(
        `UPDATE users SET company_name = $1, phone = $2, plz = $3, ort = $4, gewerke = $5 WHERE id = $6`,
        [body.companyName, body.phone || null, body.plz, body.ort, gewerke, user.id]
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return handleApiError(err, 'Profil konnte nicht gespeichert werden.')
  }
}
