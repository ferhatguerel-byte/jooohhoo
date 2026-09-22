import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getCurrentUserMock, queryMock, connectMock, clientQueryMock, releaseMock, runMatchingForJobMock } = vi.hoisted(
  () => ({
    getCurrentUserMock: vi.fn(),
    queryMock: vi.fn(),
    connectMock: vi.fn(),
    clientQueryMock: vi.fn(),
    releaseMock: vi.fn(),
    runMatchingForJobMock: vi.fn(),
  })
)
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/db', () => ({ getDb: () => ({ query: queryMock, connect: connectMock }) }))
vi.mock('@/lib/matching/run-matching', () => ({ runMatchingForJob: runMatchingForJobMock }))
vi.mock('@/lib/analytics-events', () => ({ trackEvent: vi.fn().mockResolvedValue(undefined) }))

import { POST as createJob } from '@/app/api/jobs/route'
import { PATCH as patchJob } from '@/app/api/jobs/[id]/route'

const validBody = {
  title: 'Badezimmer renovieren',
  gewerk: 'Elektro',
  plz: '10115',
  ort: 'Berlin',
  description: 'Komplettsanierung eines Badezimmers in einer Altbauwohnung.',
}

function jsonReq(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
}

describe('POST /api/jobs — Phase 4.3 Rate Limit (Teil 2/A: Job-Spam)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    connectMock.mockReset()
    clientQueryMock.mockReset()
    releaseMock.mockReset()
    runMatchingForJobMock.mockReset()
    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
    connectMock.mockResolvedValue({ query: clientQueryMock, release: releaseMock })
    clientQueryMock.mockResolvedValue({ rows: [{ id: 'job-123' }] })
    runMatchingForJobMock.mockResolvedValue({ jobId: 'job-123', resultCount: 0, eligibleCount: 0, excludedCount: 0 })
  })

  it('lehnt Job-Erstellung ab, sobald das Pro-Nutzer-Limit erreicht ist (429), ohne einen Job anzulegen', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 10 }] }) // jobs-create:user am Limit
    const res = await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(res.status).toBe(429)
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('lehnt Job-Erstellung ab, sobald das Pro-IP-Limit erreicht ist (429), auch bei unterschiedlichen Nutzer-Limits', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 0 }] }) // jobs-create:user ok
    queryMock.mockResolvedValueOnce({}) // Insert für user-Bucket
    queryMock.mockResolvedValueOnce({ rows: [{ count: 20 }] }) // jobs-create-ip am Limit
    const res = await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(res.status).toBe(429)
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('erlaubt Job-Erstellung unterhalb beider Limits', async () => {
    queryMock.mockResolvedValue({ rows: [{ count: 0 }] })
    const res = await createJob(jsonReq('http://localhost/api/jobs', validBody))
    expect(res.status).toBe(200)
  })

  it('Zod-Validierung läuft vor dem Rate Limit (kein DB-Zugriff bei ungültigem Payload)', async () => {
    const res = await createJob(jsonReq('http://localhost/api/jobs', { title: 'zu kurz' }))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Teil D: lehnt einen Titel über 200 Zeichen ab', async () => {
    const res = await createJob(jsonReq('http://localhost/api/jobs', { ...validBody, title: 'A'.repeat(201) }))
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('Teil D: lehnt eine Beschreibung über 5000 Zeichen ab', async () => {
    const res = await createJob(jsonReq('http://localhost/api/jobs', { ...validBody, description: 'A'.repeat(5001) }))
    expect(res.status).toBe(400)
  })

  it('Teil D: lehnt eine PLZ über 10 Zeichen ab', async () => {
    const res = await createJob(jsonReq('http://localhost/api/jobs', { ...validBody, plz: '1'.repeat(11) }))
    expect(res.status).toBe(400)
  })

  it('Teil D: lehnt einen Ort über 100 Zeichen ab', async () => {
    const res = await createJob(jsonReq('http://localhost/api/jobs', { ...validBody, ort: 'A'.repeat(101) }))
    expect(res.status).toBe(400)
  })

  it('Teil C: lehnt ein übergroßes Payload ab (413)', async () => {
    const res = await createJob(
      jsonReq('http://localhost/api/jobs', { ...validBody, description: 'A'.repeat(200_000) })
    )
    expect(res.status).toBe(413)
  })
})

describe('PATCH /api/jobs/[id] — Phase 4.3 Rate Limit', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    queryMock.mockReset()
    getCurrentUserMock.mockResolvedValue({ id: 'ag-1', role: 'auftraggeber' })
  })

  it('lehnt wiederholtes Bearbeiten ab, sobald das Limit erreicht ist (429)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 20 }] })
    const res = await patchJob(
      jsonReq('http://localhost/api/jobs/job-1', { title: 'Neuer Titel lang genug', description: 'Neue Beschreibung, lang genug.' }, 'PATCH'),
      { params: Promise.resolve({ id: 'job-1' }) }
    )
    expect(res.status).toBe(429)
  })

  it('Teil D: lehnt einen Titel über 200 Zeichen im Update ab', async () => {
    const res = await patchJob(
      jsonReq('http://localhost/api/jobs/job-1', { title: 'A'.repeat(201), description: 'Ausreichend lange Beschreibung.' }, 'PATCH'),
      { params: Promise.resolve({ id: 'job-1' }) }
    )
    expect(res.status).toBe(400)
    expect(queryMock).not.toHaveBeenCalled()
  })
})
