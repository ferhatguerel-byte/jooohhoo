import type { NextRequest } from 'next/server'

/** Öffentliche App-URL ohne trailing slash, damit Pfade nie doppelte "/" bekommen. */
export function getAppUrl(req?: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (req ? `${req.nextUrl.protocol}//${req.nextUrl.host}` : '')
  return base.replace(/\/+$/, '')
}
