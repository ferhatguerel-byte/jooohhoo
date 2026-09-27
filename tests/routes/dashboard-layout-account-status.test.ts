import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { getCurrentUserMock, redirectMock, isAdminMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  isAdminMock: vi.fn(() => false),
}))
vi.mock('@/lib/current-user', () => ({ getCurrentUser: getCurrentUserMock }))
vi.mock('@/lib/authorization', () => ({ isAdmin: isAdminMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/link', () => ({ default: (props: { children?: unknown }) => props.children ?? null }))
vi.mock('@/components/layout/BackButton', () => ({ default: () => null }))
vi.mock('./AccountMenu', () => ({ default: () => null }))
vi.mock('../../src/app/dashboard/AccountMenu', () => ({ default: () => null }))

import DashboardLayout from '@/app/dashboard/layout'

const baseUser = {
  id: 'u1',
  role: 'subunternehmer' as const,
  companyName: 'Musterbau GmbH',
}

/**
 * Admin-Unternehmensverwaltung – Phase K: "Bereits vorhandene Sessions müssen ebenfalls blockiert
 * werden, nicht nur Login." dashboard/layout.tsx ist die einzige Stelle, die JEDE Dashboard-Route
 * umschließt – ein Block hier wirkt für eine bereits laufende Session unabhängig davon, wann sie
 * angelegt wurde (kein separater Session-Invalidierungsmechanismus nötig).
 */
describe('Admin-Unternehmensverwaltung – dashboard/layout.tsx blockiert bestehende Sessions für gesperrte/gelöschte Accounts', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    isAdminMock.mockReset()
    isAdminMock.mockReturnValue(false)
    redirectMock.mockClear()
  })

  it('ein gelöschter Account (bereits bestehende Session) sieht die Sperr-Seite "Konto gelöscht" statt des Dashboards', async () => {
    getCurrentUserMock.mockResolvedValue({ ...baseUser, accountStatus: 'deleted' })
    const element = await DashboardLayout({ children: 'DASHBOARD_CONTENT' as unknown as React.ReactNode })
    const html = renderToStaticMarkup(element)
    expect(html).toContain('Konto gelöscht')
    expect(html).not.toContain('DASHBOARD_CONTENT')
  })

  it('ein gesperrter Account (bereits bestehende Session) sieht die Sperr-Seite "Konto gesperrt" statt des Dashboards', async () => {
    getCurrentUserMock.mockResolvedValue({ ...baseUser, accountStatus: 'suspended' })
    const element = await DashboardLayout({ children: 'DASHBOARD_CONTENT' as unknown as React.ReactNode })
    const html = renderToStaticMarkup(element)
    expect(html).toContain('Konto gesperrt')
    expect(html).not.toContain('DASHBOARD_CONTENT')
  })

  it('ein aktiver Account sieht weiterhin das normale Dashboard', async () => {
    getCurrentUserMock.mockResolvedValue({ ...baseUser, accountStatus: 'active' })
    const element = await DashboardLayout({ children: 'DASHBOARD_CONTENT' as unknown as React.ReactNode })
    const html = renderToStaticMarkup(element)
    expect(html).toContain('DASHBOARD_CONTENT')
  })

  it('ein Admin mit accountStatus != active wird NICHT ausgesperrt (Admin-Zugriff bleibt erhalten)', async () => {
    isAdminMock.mockReturnValue(true)
    getCurrentUserMock.mockResolvedValue({ ...baseUser, accountStatus: 'suspended' })
    const element = await DashboardLayout({ children: 'DASHBOARD_CONTENT' as unknown as React.ReactNode })
    const html = renderToStaticMarkup(element)
    expect(html).toContain('DASHBOARD_CONTENT')
  })

  it('kein eingeloggter User wird zu /login umgeleitet', async () => {
    getCurrentUserMock.mockResolvedValue(null)
    await expect(
      DashboardLayout({ children: 'DASHBOARD_CONTENT' as unknown as React.ReactNode })
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })
})
