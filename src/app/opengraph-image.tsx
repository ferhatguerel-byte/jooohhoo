import { ImageResponse } from 'next/og'

export const alt = 'BauPartner24 – Subunternehmer für Ihre Bauprojekte finden'
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
          background: 'linear-gradient(135deg, #172554 0%, #1e3a8a 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#f97316',
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
            BauPartner<span style={{ color: '#f97316' }}>24</span>
          </div>
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: 'white', lineHeight: 1.15, maxWidth: 950 }}>
          Der Marktplatz für Subunternehmer im Baugewerbe
        </div>
        <div style={{ fontSize: 28, color: '#bfdbfe', marginTop: 24 }}>
          Auftrag einstellen · Angebote erhalten · Direkt beauftragen
        </div>
      </div>
    ),
    { ...size }
  )
}
