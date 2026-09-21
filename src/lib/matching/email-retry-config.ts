/**
 * Phase 3.6F – zentrale Konfiguration für Retry/Backoff/Rate-Limit der Match-E-Mail-Zustellung.
 * Bewusst getrennt von score-config.ts (Match Score) – diese Werte betreffen ausschließlich den
 * nachgelagerten E-Mail-Kanal, niemals Matching/Score/Threshold. Alle Werte sind initiale,
 * technische Defaults, keine unveränderlichen Produktregeln.
 */

/** Ab dieser Anzahl tatsächlich gestarteter Versandversuche kein weiterer automatischer Retry. */
export const MAX_MATCH_EMAIL_ATTEMPTS = 3

/**
 * Gestufter Backoff vor dem jeweils nächsten Versuch, indiziert nach der aktuellen `attempts`-
 * Zahl (1-basiert): nach dem 1. Fehlschlag `MATCH_EMAIL_BACKOFF_SECONDS[0]` Sekunden warten,
 * nach dem 2. Fehlschlag `MATCH_EMAIL_BACKOFF_SECONDS[1]` Sekunden. Ein 3. Fehlschlag erreicht
 * bereits MAX_MATCH_EMAIL_ATTEMPTS und wird nicht mehr erneut versucht – daher keine dritte Stufe
 * nötig. Bewusst als reine Wartezeit auf Basis von `processing_started_at` berechnet, keine
 * zusätzliche `next_attempt_at`-Spalte.
 */
export const MATCH_EMAIL_BACKOFF_SECONDS: [number, number] = [60, 300]

/**
 * Lease-Timeout für den Zustand 'sending': eine seit dieser Zeitspanne hängende Zeile (Crash
 * zwischen Claim und finalem Status-Update) gilt als abgebrochen und wird wieder claimbar.
 * Bewusst konservativ gewählt (5 Minuten) – ein normaler Resend-Request dauert Sekunden, keine
 * Minuten; kein aggressives Recovery innerhalb weniger Sekunden (Phase 3.6F §12).
 */
export const MATCH_EMAIL_LEASE_SECONDS = 300

/**
 * Maximale Anzahl an Versandversuchen (Claims), die ein einzelner Retry-Batch-Lauf startet.
 * Ein einzelner Job mit sehr vielen Matches darf nicht hunderte E-Mails ohne Begrenzung auslösen
 * (Phase 3.6F §17) – der Rest bleibt retryfähig und wird vom nächsten Lauf übernommen.
 */
export const MAX_MATCH_EMAILS_PER_RUN = 20
