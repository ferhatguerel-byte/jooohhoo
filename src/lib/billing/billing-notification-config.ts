/**
 * Phase 2B – zentrale Konfiguration für Retry/Backoff/Rate-Limit der Abo-Bestätigungs-E-Mails
 * (Vertrags- und Kündigungsbestätigung). Eigenständig von email-retry-config.ts (Match-E-Mails) –
 * unterschiedlicher Kanal, keine gemeinsame Zustandsmaschine, damit eine Änderung an der einen
 * Konfiguration die andere nicht versehentlich mitbeeinflusst. Werte bewusst identisch zum
 * bewährten Match-E-Mail-Muster übernommen (initiale technische Defaults, keine Produktregel).
 */

export const MAX_BILLING_NOTIFICATION_ATTEMPTS = 3

export const BILLING_NOTIFICATION_BACKOFF_SECONDS: [number, number] = [60, 300]

export const BILLING_NOTIFICATION_LEASE_SECONDS = 300

export const MAX_BILLING_NOTIFICATIONS_PER_RUN = 20
