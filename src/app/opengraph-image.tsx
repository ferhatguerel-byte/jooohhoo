import { ImageResponse } from 'next/og'

export const alt = 'RundumWerk24 – Umzüge, Transporte, Reinigung & Bau'
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
            R
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 900, color: 'white' }}>
            RundumWerk<span style={{ color: '#f97316' }}>24</span>
          </div>
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: 'white', lineHeight: 1.15, maxWidth: 950 }}>
          Umzug, Transport, Reinigung &amp; Bau – alles aus einer Hand
        </div>
        <div style={{ fontSize: 28, color: '#bfdbfe', marginTop: 24 }}>
          Festpreis-Garantie · Versichert · Deutschlandweit
        </div>
      </div>
    ),
    { ...size }
  )
}
