import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'bp24_session'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (secret) return new TextEncoder().encode(secret)

  if (process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode('dev-only-insecure-secret-change-me')
  }

  throw new Error(
    'SESSION_SECRET ist nicht gesetzt. In Production darf hierfür kein unsicherer Standardwert ' +
      'verwendet werden. Bitte die Umgebungsvariable in den Vercel-Projekteinstellungen setzen.'
  )
}

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    await jwtVerify(token, getSecret())
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
