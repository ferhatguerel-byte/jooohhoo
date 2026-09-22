import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  queryMock: vi.fn(),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock }) }))

import { POST } from '@/app/api/profile/route'

const baseSubunternehmer = {
  id: 'sub-1',
  role: 'subunternehmer' as const,
  verificationStatus: 'unverified' as const,
  blockedGewerke: [] as string[],
  qualificationFiles: [] as { fileId: string; name: string; label: string }[],
}

const baseAuftraggeber = {
  id: 'ag-1',
  role: 'auftraggeber' as const,
  verificationStatus: 'unverified' as const,
  blockedGewerke: [] as string[],
  qualificationFiles: [] as { fileId: string; name: string; label: string }[],
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/profile', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const validBody = { companyName: 'Muster GmbH', plz: '10115', ort: 'Berlin' }

describe('POST /api/profile — Phase 3.2 Matching-Präferenzen (Validierung)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    // Phase 4.3: POST /api/profile prüft nach der Zod-Validierung ein Rate Limit (COUNT + INSERT
    // über denselben queryMock) – count:0 lässt es unbegrenzt oft durchlaufen. Die eigentliche
    // UPDATE-Query ist danach der dritte Aufruf.
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
  })

  it('akzeptiert einen gültigen service_radius_km', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, serviceRadiusKm: 50 }))
    expect(res.status).toBe(200)
    const [sql, params] = queryMock.mock.calls[2]
    expect(sql).toContain('service_radius_km')
    expect(params).toContain(50)
  })

  it('akzeptiert service_radius_km = null (keine Angabe)', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, serviceRadiusKm: null }))
    expect(res.status).toBe(200)
  })

  it('Phase 4.1: lehnt einen zu langen Firmennamen ab (>150 Zeichen)', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, companyName: 'A'.repeat(151) }))
    expect(res.status).toBe(400)
    // Zod validiert vor jedem DB-Zugriff (profileSchema.parse() zuerst in route.ts).
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Phase 4.1: akzeptiert einen Firmennamen an der exakten Grenze (150 Zeichen)', async () => {
    getCurrentUserMock.mockResolvedValue(baseAuftraggeber)
    const res = await POST(req({ ...validBody, companyName: 'A'.repeat(150) }))
    expect(res.status).not.toBe(400)
  })

  it('lehnt einen negativen service_radius_km ab', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, serviceRadiusKm: -10 }))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('lehnt einen unrealistisch hohen service_radius_km ab', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, serviceRadiusKm: 50000 }))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('akzeptiert einen gültigen min_project_size', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, minProjectSize: 10000 }))
    expect(res.status).toBe(200)
  })

  it('akzeptiert einen gültigen max_project_size', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, maxProjectSize: 100000 }))
    expect(res.status).toBe(200)
  })

  it('lehnt min_project_size > max_project_size ab', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, minProjectSize: 100000, maxProjectSize: 10000 }))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('akzeptiert beide Felder als null/fehlend', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody }))
    expect(res.status).toBe(200)
  })

  it('akzeptiert nur min_project_size gesetzt', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, minProjectSize: 5000 }))
    expect(res.status).toBe(200)
  })

  it('akzeptiert nur max_project_size gesetzt', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    const res = await POST(req({ ...validBody, maxProjectSize: 5000 }))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/profile — Phase 3.2 Security', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    // Phase 4.3: siehe Kommentar im Validierungs-describe-Block oben – calls[0]/[1] sind die
    // Rate-Limit-Prüfung, die eigentliche UPDATE-Query ist calls[2].
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
  })

  it('ein angemeldeter Unternehmer ändert ausschließlich seine eigene Zeile (WHERE id = eigene id)', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    await POST(req({ ...validBody, serviceRadiusKm: 25 }))
    const [, params] = queryMock.mock.calls[2]
    expect(params[params.length - 1]).toBe(baseSubunternehmer.id)
  })

  it('lehnt nicht angemeldete Anfragen ab, keine DB-Schreibaktion', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    const res = await POST(req({ ...validBody, serviceRadiusKm: 25 }))
    expect(res.status).toBe(401)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('ein Auftraggeber kann die Matching-Felder nicht setzen (werden serverseitig ignoriert/auf null erzwungen)', async () => {
    getCurrentUserMock.mockResolvedValue(baseAuftraggeber)
    const res = await POST(req({ ...validBody, serviceRadiusKm: 999, minProjectSize: 1, maxProjectSize: 2 }))
    expect(res.status).toBe(200)
    const [, params] = queryMock.mock.calls[2]
    // Kein Wert 999/1/2 darf in den gespeicherten Parametern auftauchen – die Route erzwingt null
    // für Nicht-Unternehmer, unabhängig davon, was der Request-Body enthält (Mass-Assignment-Schutz).
    expect(params).not.toContain(999)
    expect(params).not.toContain(1)
    expect(params).not.toContain(2)
  })

  it('es gibt keinen Weg, die id eines anderen Nutzers über den Body zu beeinflussen (kein userId-Feld im Schema)', async () => {
    getCurrentUserMock.mockResolvedValue(baseSubunternehmer)
    await POST(req({ ...validBody, id: 'someone-elses-id', userId: 'someone-elses-id', serviceRadiusKm: 25 }))
    const [, params] = queryMock.mock.calls[2]
    expect(params[params.length - 1]).toBe(baseSubunternehmer.id)
    expect(params).not.toContain('someone-elses-id')
  })
})
