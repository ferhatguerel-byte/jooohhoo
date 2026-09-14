/**
 * Berechnet, zu welchem Datum eine heute erklärte Kündigung des Jahrespakets wirksam wird.
 *
 * Regel: Der Vertrag läuft in 12-Monats-Zyklen (verankert am ursprünglichen `committedUntil`).
 * Eine Kündigung muss spätestens `noticeMonths` Monate vor Ablauf des laufenden Zyklus eingehen,
 * sonst verlängert sich der Vertrag automatisch um einen weiteren Zyklus.
 */
export function computeCancellationEffectiveDate(
  committedUntil: Date,
  now: Date = new Date(),
  noticeMonths = 3
): Date {
  const termEnd = new Date(committedUntil.getTime())
  while (termEnd.getTime() <= now.getTime()) {
    termEnd.setUTCMonth(termEnd.getUTCMonth() + 12)
  }

  const noticeDeadline = new Date(termEnd.getTime())
  noticeDeadline.setUTCMonth(noticeDeadline.getUTCMonth() - noticeMonths)

  if (now.getTime() <= noticeDeadline.getTime()) {
    return termEnd
  }

  const nextTermEnd = new Date(termEnd.getTime())
  nextTermEnd.setUTCMonth(nextTermEnd.getUTCMonth() + 12)
  return nextTermEnd
}
