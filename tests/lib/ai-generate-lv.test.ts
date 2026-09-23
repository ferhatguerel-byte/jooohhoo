import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateLeistungsverzeichnis } from '@/lib/ai'

/**
 * Phase 5 – der Anthropic-Fetch-Aufruf hatte bislang kein explizites Timeout und keinen
 * try/catch um Netzwerk-/Abort-Fehler: ein hängender Request wäre ungefangen bis zum
 * Plattform-Timeout durchgelaufen statt mit einer verständlichen Fehlermeldung zurückzukehren.
 */
describe('generateLeistungsverzeichnis', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey
    vi.unstubAllGlobals()
  })

  it('parses a valid Anthropic response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: '{"items": [{"gewerk": "Elektro", "title": "Elektroinstallation", "description": "Neuverkabelung"}], "estimatedCostMin": 1000, "estimatedCostMax": 2000}' }],
        }),
      })
    )

    const result = await generateLeistungsverzeichnis('Beschreibung meines Projekts')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe('Elektroinstallation')
    expect(result.estimatedCostMin).toBe(1000)
  })

  it('throws a generic error when the network request fails or times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'TimeoutError'))
    )

    await expect(generateLeistungsverzeichnis('Beschreibung meines Projekts')).rejects.toThrow(
      'Leistungsverzeichnis konnte nicht generiert werden'
    )
  })

  it('throws a generic error on a non-ok HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' })
    )

    await expect(generateLeistungsverzeichnis('Beschreibung meines Projekts')).rejects.toThrow(
      'Leistungsverzeichnis konnte nicht generiert werden'
    )
  })
})
