import { redirect } from 'next/navigation'
import { getCurrentUser, type CurrentUser } from '@/lib/current-user'

/**
 * Zentrale Authorization-Schicht. Ersetzt die vormals in 22 Dateien duplizierte Prüfung
 * `user.email === process.env.ADMIN_EMAIL`. Alle Berechtigungsprüfungen laufen serverseitig
 * über diese Funktionen – ein rein clientseitiges Verstecken von UI-Elementen reicht nicht aus.
 */

/**
 * Sehr einfaches Berechtigungsmodell: aktuell existiert nur eine Admin-Rolle, die alle
 * Admin-Rechte besitzt (kein abgestuftes Rechtesystem). `Permission` und `hasPermission`
 * sind der Erweiterungspunkt, falls künftig einzelne Admin-Berechtigungen statt eines
 * einzigen Alles-oder-Nichts-Admins eingeführt werden sollen.
 */
export type Permission = 'admin:*'

export function isAdmin(user: Pick<CurrentUser, 'email'> | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL
  return !!adminEmail && !!user && user.email === adminEmail
}

export function hasPermission(user: CurrentUser | null | undefined, permission: Permission): boolean {
  if (permission === 'admin:*') return isAdmin(user)
  return false
}

/** Für API Route Handler: wird von handleApiError (src/lib/api-error.ts) in eine HTTP-Antwort übersetzt. */
export class AuthorizationError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

// ---- Varianten für Server Components / Pages (redirect statt Response) ----

/** Lädt den eingeloggten Nutzer oder leitet zu /login um. */
export async function requireAuthenticatedUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/** Erzwingt eine bestimmte Rolle, sonst redirect zum Dashboard. */
export async function requireRole(role: CurrentUser['role']): Promise<CurrentUser> {
  const user = await requireAuthenticatedUser()
  if (user.role !== role) redirect('/dashboard')
  return user
}

/** Erzwingt Admin-Rechte, sonst redirect zum Dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuthenticatedUser()
  if (!isAdmin(user)) redirect('/dashboard')
  return user
}

// ---- Varianten für API Route Handler (werfen AuthorizationError statt zu redirecten) ----

/** Lädt den eingeloggten Nutzer oder wirft 401. */
export async function requireAuthenticatedUserApi(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthorizationError('Nicht angemeldet.', 401)
  return user
}

/** Erzwingt eine bestimmte Rolle, sonst 403. */
export async function requireRoleApi(role: CurrentUser['role'], message?: string): Promise<CurrentUser> {
  const user = await requireAuthenticatedUserApi()
  if (user.role !== role) throw new AuthorizationError(message || 'Kein Zugriff.', 403)
  return user
}

/** Erzwingt Admin-Rechte, sonst 403. */
export async function requireAdminApi(): Promise<CurrentUser> {
  const user = await requireAuthenticatedUserApi()
  if (!isAdmin(user)) throw new AuthorizationError('Kein Zugriff.', 403)
  return user
}

/** Erzwingt eine bestimmte Permission (aktuell nur 'admin:*'), sonst 403. */
export async function requirePermissionApi(permission: Permission): Promise<CurrentUser> {
  const user = await requireAuthenticatedUserApi()
  if (!hasPermission(user, permission)) throw new AuthorizationError('Kein Zugriff.', 403)
  return user
}

/**
 * Admin-Unternehmensverwaltung – zentrale Absicherung gegen eine bereits bestehende, noch
 * gültige Session eines gesperrten (`suspended`) oder gelöschten (`deleted`) Kontos: Login und
 * das Dashboard-UI (dashboard/layout.tsx) blockieren bereits, aber eine API-Route ist davon
 * unabhängig über einen direkten Aufruf erreichbar. Statt dieselbe Prüfung in jeder mutierenden
 * Account-/Business-Route einzeln zu kopieren, erzwingt dieser eine Helper `account_status ===
 * 'active'` – jede betroffene Route ruft ausschließlich ihn auf (siehe api/profile,
 * api/account/*, api/upload, api/jobs/[id]/hide, api/support/tickets*).
 *
 * Admin-Accounts sind bewusst ausgenommen: diese Prüfung darf niemals eine Admin-Funktion
 * blockieren (Admin-Routen haben ohnehin ihre eigene requireAdminApi()-Gate-Logik; auf
 * gemeinsam genutzten Routen wie support/tickets/[id]/messages, die sowohl vom Ticket-Ersteller
 * als auch von einem antwortenden Admin aufgerufen werden, verhindert die Ausnahme, dass ein
 * Admin durch seinen eigenen accountStatus blockiert würde).
 */
export async function requireActiveUserApi(): Promise<CurrentUser> {
  const user = await requireAuthenticatedUserApi()
  if (!isAdmin(user) && user.accountStatus !== 'active') {
    throw new AuthorizationError('Ihr Konto ist nicht aktiv.', 403)
  }
  return user
}
