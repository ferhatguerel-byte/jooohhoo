import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#172554',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            color: '#f97316',
            fontFamily: 'sans-serif',
          }}
        >
          R
        </div>
      </div>
    ),
    { ...size }
  )
}
