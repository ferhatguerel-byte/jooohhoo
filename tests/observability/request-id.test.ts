import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import {
  isValidRequestId,
  generateRequestId,
  resolveRequestId,
  getRequestId,
  REQUEST_ID_HEADER,
} from '@/lib/observability/request-id'

describe('request-id — Phase 4.4 (Teil F)', () => {
  it('generateRequestId() liefert eine syntaktisch valide UUID', () => {
    const id = generateRequestId()
    expect(isValidRequestId(id)).toBe(true)
  })

  it('isValidRequestId() akzeptiert eine echte UUID', () => {
    expect(isValidRequestId('a091c25f-1ebb-4207-a3c9-f88621b90ae6')).toBe(true)
  })

  it('isValidRequestId() lehnt leere/fehlende Werte ab', () => {
    expect(isValidRequestId(null)).toBe(false)
    expect(isValidRequestId(undefined)).toBe(false)
    expect(isValidRequestId('')).toBe(false)
  })

  it('isValidRequestId() lehnt manipulierte/nicht-UUID-Werte ab (kein blindes Vertrauen)', () => {
    expect(isValidRequestId('not-a-uuid')).toBe(false)
    expect(isValidRequestId('<script>alert(1)</script>')).toBe(false)
    expect(isValidRequestId('a'.repeat(500))).toBe(false)
  })

  it('resolveRequestId() übernimmt eine valide Client-ID unverändert', () => {
    const clientId = generateRequestId()
    expect(resolveRequestId(clientId)).toBe(clientId)
  })

  it('resolveRequestId() erzeugt eine neue ID für einen ungültigen Client-Wert', () => {
    const result = resolveRequestId('garbage')
    expect(isValidRequestId(result)).toBe(true)
    expect(result).not.toBe('garbage')
  })

  it('getRequestId() liest den Header von einem Request', () => {
    const validId = generateRequestId()
    const req = new NextRequest('http://localhost/api/test', { headers: { [REQUEST_ID_HEADER]: validId } })
    expect(getRequestId(req)).toBe(validId)
  })

  it('getRequestId() erzeugt eine neue ID, wenn kein Header vorhanden ist', () => {
    const req = new NextRequest('http://localhost/api/test')
    expect(isValidRequestId(getRequestId(req))).toBe(true)
  })
})
