import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { readJsonBody, PayloadTooLargeError } from '@/lib/security/request-limits'

function reqWithBody(body: string, contentLength?: string) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (contentLength !== undefined) headers.set('content-length', contentLength)
  return new NextRequest('http://localhost/api/test', { method: 'POST', body, headers })
}

describe('readJsonBody — Phase 4.3 (Teil C) Payload-Limits', () => {
  it('parst ein normales, kleines JSON-Payload korrekt', async () => {
    const result = await readJsonBody(reqWithBody(JSON.stringify({ title: 'Hallo' })))
    expect(result).toEqual({ title: 'Hallo' })
  })

  it('lehnt ein Payload ab, dessen Content-Length-Header das Limit überschreitet (ohne den Body zu lesen)', async () => {
    const body = JSON.stringify({ title: 'x' })
    await expect(readJsonBody(reqWithBody(body, '999999999'), 100)).rejects.toBeInstanceOf(PayloadTooLargeError)
  })

  it('lehnt ein Payload ab, dessen tatsächliche Größe das Limit überschreitet (auch ohne korrekten Content-Length-Header)', async () => {
    const bigBody = JSON.stringify({ title: 'x'.repeat(1000) })
    await expect(readJsonBody(reqWithBody(bigBody), 100)).rejects.toBeInstanceOf(PayloadTooLargeError)
  })

  it('akzeptiert ein Payload genau an der Grenze', async () => {
    const value = 'a'.repeat(10)
    const body = JSON.stringify({ v: value })
    const maxBytes = Buffer.byteLength(body, 'utf8')
    await expect(readJsonBody(reqWithBody(body), maxBytes)).resolves.toEqual({ v: value })
  })

  it('verwendet einen großzügigen Default (100 KB), wenn kein maxBytes übergeben wird', async () => {
    const body = JSON.stringify({ message: 'a'.repeat(5000) })
    await expect(readJsonBody(reqWithBody(body))).resolves.toEqual({ message: 'a'.repeat(5000) })
  })
})
