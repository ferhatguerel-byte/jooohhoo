import { GEWERKE } from '@/lib/gewerke'

export interface GeneratedLineItem {
  gewerk: string
  title: string
  description: string
}

const SYSTEM_PROMPT = `Du bist ein Bausachverständiger, der aus einer Kundenbeschreibung ein strukturiertes Leistungsverzeichnis (LV) für Bau- und Renovierungsarbeiten erstellt.

Regeln:
- Zerlege das Projekt in einzelne Gewerke/Positionen (z.B. Abbruch, Elektro, Sanitär, Trockenbau, Boden, Maler).
- Nutze für "gewerk" ausschließlich einen dieser Werte: ${GEWERKE.join(', ')}.
- Jede Position bekommt einen kurzen Titel und eine knappe, konkrete Beschreibung des Leistungsumfangs.
- Erfinde keine Mengen oder Maße, die nicht aus der Beschreibung hervorgehen oder branchenüblich sind.
- Antworte AUSSCHLIESSLICH mit einem JSON-Array, keine Erklärungen, kein Markdown, kein Codeblock.

Format:
[{"gewerk": "Elektro", "title": "Elektroinstallation komplett", "description": "Neuverkabelung, Steckdosen, Schalter, Sicherungskasten prüfen"}]`

export async function generateLeistungsverzeichnis(description: string): Promise<GeneratedLineItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('KI-Funktion ist noch nicht konfiguriert (ANTHROPIC_API_KEY fehlt).')
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Projektbeschreibung des Kunden:\n\n${description}` }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Anthropic API Fehler:', res.status, errText)
    throw new Error('Leistungsverzeichnis konnte nicht generiert werden. Bitte später erneut versuchen.')
  }

  const data = await res.json()
  const text: string = data.content?.[0]?.text || '[]'

  let parsed: unknown
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    throw new Error('Antwort der KI konnte nicht verarbeitet werden.')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Unerwartetes Antwortformat der KI.')
  }

  const validGewerke = new Set<string>(GEWERKE)
  const items: GeneratedLineItem[] = parsed
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      gewerk: validGewerke.has(String(item.gewerk)) ? String(item.gewerk) : GEWERKE[0],
      title: String(item.title || '').slice(0, 200),
      description: String(item.description || '').slice(0, 1000),
    }))
    .filter((item) => item.title.length > 0)

  if (items.length === 0) {
    throw new Error('Es konnten keine Leistungspositionen aus der Beschreibung erstellt werden.')
  }

  return items
}
