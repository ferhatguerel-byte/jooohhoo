import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'

const SESSION_COOKIE = 'bp24_session'
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30 // 30 Tage

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

export type UserRole = 'auftraggeber' | 'subunternehmer'

export interface SessionPayload {
  userId: string
  role: UserRole
  [key: string]: unknown
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  })
}

export async function destroySessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return { token, tokenHash }
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export { SESSION_COOKIE }
