/**
 * Phase 2E – zentrale, stabile Versionskennung der aktuell gültigen AGB-Fassung
 * (src/app/agb/page.tsx). Ändert sich NICHT automatisch bei jedem Build/Deployment – nur bewusst,
 * wenn der AGB-Text inhaltlich geändert wird. Wird konsistent sowohl bei der Registrierung
 * (users.terms_version) als auch im Vertragsdaten-Snapshot bei Abo-Aktivierung
 * (billing_notification_outbox.payload.agbVersion) verwendet.
 *
 * Format: ISO-Datum des Tages der letzten inhaltlichen Änderung dieser AGB-Fassung. Kein
 * Build-Zeitstempel, kein Commit-Hash – beides würde bei jedem Deployment wechseln, auch ohne
 * inhaltliche Änderung.
 *
 * WICHTIG: Diese Konstante trifft KEINE rechtliche Aussage darüber, ob die hier referenzierte
 * AGB-Fassung wirksam in Verträge einbezogen wird oder ob die Versionierung selbst den
 * rechtlichen Anforderungen an einen Zustimmungsnachweis genügt (siehe Verbraucherrecht-Audit,
 * Phase 1/2A–2D – weiterhin offene, anwaltlich zu klärende Frage).
 *
 * Bei einer künftigen inhaltlichen Änderung der AGB (src/app/agb/page.tsx) MUSS dieser Wert
 * manuell auf das Datum der Änderung aktualisiert werden.
 */
export const CURRENT_TERMS_VERSION = '2026-10-15'
