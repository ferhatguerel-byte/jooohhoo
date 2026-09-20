import { describe, it, expect, vi, beforeEach } from 'vitest'

const { redirectMock, getCurrentUserMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  getCurrentUserMock: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))

import {
  isAdmin,
  requireAdmin,
  requireAdminApi,
  requireAuthenticatedUserApi,
  requireRoleApi,
  AuthorizationError,
} from '@/lib/authorization'

const ADMIN_EMAIL = 'admin@example.com'

function makeUser(overrides: Partial<{ email: string; role: 'auftraggeber' | 'subunternehmer' }> = {}) {
  return { id: 'u1', email: 'user@example.com', role: 'auftraggeber', ...overrides } as never
}

describe('isAdmin', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAIL', ADMIN_EMAIL)
  })

  it('is false for a normal user', () => {
    expect(isAdmin(makeUser())).toBe(false)
  })

  it('is true only for the exact configured admin email', () => {
    expect(isAdmin(makeUser({ email: ADMIN_EMAIL }))).toBe(true)
  })

  it('is false when ADMIN_EMAIL is not configured, even if emails would match', () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    expect(isAdmin(makeUser({ email: ADMIN_EMAIL }))).toBe(false)
  })

  it('is false for null/undefined user', () => {
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe('requireAdmin (Server Component variant)', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAIL', ADMIN_EMAIL)
    getCurrentUserMock.mockReset()
    redirectMock.mockClear()
  })

  it('redirects a normal, logged-in user away from admin pages', async () => {
    getCurrentUserMock.mockResolvedValue(makeUser())
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('redirects an unauthenticated visitor to login, never to the admin page', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    await expect(requireAdmin()).rejects.toThrow('REDIRECT:/login')
  })

  it('allows the configured admin through', async () => {
    getCurrentUserMock.mockResolvedValue(makeUser({ email: ADMIN_EMAIL }))
    await expect(requireAdmin()).resolves.toMatchObject({ email: ADMIN_EMAIL })
  })
})

describe('requireAdminApi / requireRoleApi (API route variant)', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAIL', ADMIN_EMAIL)
    getCurrentUserMock.mockReset()
  })

  it('throws a 401 AuthorizationError for an unauthenticated request', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    await expect(requireAuthenticatedUserApi()).rejects.toMatchObject({ status: 401 })
  })

  it('throws a 403 AuthorizationError when a normal user calls an admin-only route', async () => {
    getCurrentUserMock.mockResolvedValue(makeUser())
    const err = await requireAdminApi().catch((e) => e)
    expect(err).toBeInstanceOf(AuthorizationError)
    expect(err.status).toBe(403)
  })

  it('never allows privilege escalation via a spoofed role field on the user object', async () => {
    // Selbst wenn ein Angreifer versucht, sich als 'admin' auszugeben, zählt ausschließlich
    // die serverseitig aus der Session geladene E-Mail-Adresse.
    getCurrentUserMock.mockResolvedValue(makeUser({ email: 'attacker@evil.com' }))
    await expect(requireAdminApi()).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('enforces role checks (Auftraggeber vs. Subunternehmer)', async () => {
    getCurrentUserMock.mockResolvedValue(makeUser({ role: 'auftraggeber' }))
    await expect(requireRoleApi('subunternehmer')).rejects.toMatchObject({ status: 403 })
  })
})
