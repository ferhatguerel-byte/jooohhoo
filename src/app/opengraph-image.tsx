import { ImageResponse } from 'next/og'

export const alt = 'BAUCONNECT – Geprüfte Handwerker. Vergleichbare Angebote.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px',
          background: '#17202a',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#f47b20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 900,
              color: 'white',
            }}
          >
            B
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 900, color: 'white' }}>
            BAU<span style={{ color: '#f47b20' }}>CONNECT</span>
          </div>
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: 'white', lineHeight: 1.15, maxWidth: 950 }}>
          Geprüfte Handwerker. Vergleichbare Angebote.
        </div>
        <div style={{ fontSize: 28, color: '#9aa5b1', marginTop: 24 }}>
          KI-Leistungsverzeichnis · Festpreis-Schutz · Bewertungssystem
        </div>
      </div>
    ),
    { ...size }
  )
}
