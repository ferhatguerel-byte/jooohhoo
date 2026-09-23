import type { Metadata } from 'next'
import Link from 'next/link'
import SiteFooter from '@/components/layout/SiteFooter'

// Phase 4.5 QA: kein "– BAUVERSUS"-Suffix hier – das Root-Layout hängt es bereits per
// Titel-Template an (siehe src/app/layout.tsx), sonst entsteht "AGB – BAUVERSUS – BAUVERSUS".
export const metadata: Metadata = { title: 'AGB' }

export default function AgbPage() {
  return (
    <>
    <div className="max-w-3xl mx-auto px-6 py-16 text-slate-700">
      <Link href="/" className="text-sm text-brand hover:underline">← Zurück zur Startseite</Link>
      <h1 className="text-3xl font-black text-slate-900 mt-6 mb-8">Allgemeine Geschäftsbedingungen</h1>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 1 Geltungsbereich und Leistungsbeschreibung</h2>
        <p>
          Diese AGB gelten für die Nutzung der Vermittlungsplattform BAUVERSUS (Betreiber: GGV BAU GmbH,
          nachfolgend „Betreiber“). BAUVERSUS vermittelt Kontakte zwischen Auftraggebern – Privatpersonen
          oder Unternehmen, die Bau-, Renovierungs- oder Handwerksleistungen ausschreiben – und
          Handwerksbetrieben bzw. Unternehmern, die entsprechende Leistungen anbieten (gemeinsam
          „Anbieter“). Das Leistungsverzeichnis eines Auftrags kann automatisiert mithilfe künstlicher
          Intelligenz aus der Projektbeschreibung des Auftraggebers erstellt werden; der Auftraggeber ist
          für die Richtigkeit und Vollständigkeit der finalen, von ihm veröffentlichten Fassung
          verantwortlich. Der Betreiber ist selbst nicht Vertragspartei der zwischen Auftraggeber und
          Anbieter geschlossenen Werk- oder Dienstverträge.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 2 Registrierung</h2>
        <p>
          Die Registrierung als Auftraggeber ist kostenlos; die Einstellung von Aufträgen ist für
          Auftraggeber dauerhaft kostenfrei. Die Registrierung als Unternehmer ist ebenfalls
          kostenlos; das Einsehen offener Aufträge sowie die Kontaktaufnahme zu Auftraggebern und die
          Abgabe von Angeboten setzen ein aktives, kostenpflichtiges Abonnement voraus.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 3 Abo-Modelle für Unternehmer</h2>
        <p className="mb-3">
          Unternehmer können zwischen zwei Abo-Modellen wählen, die sich ausschließlich in der
          Abrechnungsart unterscheiden – der Leistungsumfang (unbegrenztes Einsehen offener Aufträge,
          Kontaktaufnahme und Angebotsabgabe) ist bei beiden identisch:
        </p>
        <ul className="list-disc pl-6 space-y-1 mb-3">
          <li>
            <strong>Monatspaket:</strong> monatliche Abrechnung ohne Mindestlaufzeit, jederzeit zum Ende der
            laufenden Abrechnungsperiode kündbar.
          </li>
          <li>
            <strong>Jahrespaket:</strong> ebenfalls monatliche Abbuchung, jedoch mit einer Vertragslaufzeit von
            12 Monaten ab Vertragsschluss. Die ordentliche Kündigung ist jederzeit möglich, wird jedoch erst zum
            Ende der jeweils laufenden 12-Monats-Vertragsperiode wirksam. Die Kündigung muss dem Unternehmer
            mit einer Frist von 3 Monaten vor Ablauf der jeweiligen Vertragsperiode zugehen; andernfalls
            verlängert sich das Jahrespaket automatisch um weitere 12 Monate.
          </li>
        </ul>
        <p className="mb-3">
          Die jeweils aktuellen Preise sind auf der Website unter „Preise&rdquo; einsehbar. Das gesetzliche
          Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt von einer vereinbarten
          Mindestlaufzeit unberührt.
        </p>
        <p>
          Die Registrierung als Unternehmer und der Abschluss eines Abo-Modells setzen voraus, dass der
          Nutzer in Ausübung seiner gewerblichen oder selbständigen beruflichen Tätigkeit handelt (§ 14
          BGB). Ein gesetzliches Verbraucherwiderrufsrecht nach §§ 312g, 355 BGB besteht für diese
          Verträge daher grundsätzlich nicht.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 4 Zahlung und Kündigung</h2>
        <p>
          Die Abo-Gebühr wird monatlich im Voraus über den Zahlungsdienstleister Stripe abgebucht – auch beim
          Jahrespaket erfolgt die Abbuchung monatlich, nicht als Jahresbetrag im Voraus. Das Monatspaket kann
          jederzeit zum Ende der laufenden Abrechnungsperiode über die Kontoverwaltung gekündigt werden. Beim
          Jahrespaket ist eine Kündigung unter Einhaltung der in § 3 genannten Mindestlaufzeit und
          Kündigungsfrist möglich. Bereits gezahlte Gebühren werden nicht anteilig erstattet.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 5 Pflichten der Nutzer</h2>
        <p>
          Nutzer verpflichten sich, wahrheitsgemäße Angaben zu ihrem Unternehmen zu machen und Aufträge
          bzw. Angebote sachlich korrekt darzustellen. Der Betreiber behält sich vor, Inhalte zu entfernen
          und Konten bei Missbrauch zu sperren.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 6 Bewertungen</h2>
        <p>
          Eine Bewertung kann ausschließlich von dem Auftraggeber abgegeben werden, der dem bewerteten
          Unternehmer einen Auftrag über die Plattform tatsächlich vergeben hat; das System erlaubt keine
          Bewertung ohne einen zugrundeliegenden, auf der Plattform vergebenen Auftrag. Eine inhaltliche
          Prüfung der Bewertungstexte auf Richtigkeit findet darüber hinaus nicht statt.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 7 Haftungsausschluss</h2>
        <p className="mb-3">
          Der Betreiber ist reiner Vermittler und stellt lediglich die technische Plattform zur Verfügung.
          Er wird nicht Vertragspartei der zwischen Auftraggeber und Unternehmer zustande kommenden
          Werk- oder Dienstverträge und übernimmt keine Verantwortung für deren Zustandekommen, Inhalt,
          Durchführung oder Erfüllung.
        </p>
        <p className="mb-3">
          Der Betreiber übernimmt insbesondere keine Gewähr und keine Haftung für: die Richtigkeit,
          Vollständigkeit oder Aktualität von Nutzerangaben, Auftragsbeschreibungen, Angeboten oder
          Bewertungen; die Qualifikation, Zuverlässigkeit, Bonität oder Eignung von Auftraggebern und
          Unternehmern; den Erfolg, die Qualität oder die ordnungsgemäße, fristgerechte Durchführung
          vermittelter Aufträge; Schäden, die im Rahmen der Durchführung eines vermittelten Auftrags
          entstehen (einschließlich Personen-, Sach- und Vermögensschäden). Für all dies haftet
          ausschließlich das jeweils beauftragte Unternehmen bzw. der jeweilige Auftraggeber im
          Verhältnis zueinander.
        </p>
        <p className="mb-3">
          Die von der Plattform mithilfe künstlicher Intelligenz erstellten Leistungsverzeichnisse und
          Kostenschätzungen sind automatisiert generierte, unverbindliche Orientierungshilfen ohne
          Anspruch auf Vollständigkeit oder Richtigkeit. Sie ersetzen keine fachliche Begutachtung vor
          Ort, kein verbindliches Angebot und keine bautechnische oder rechtliche Beratung. Der Betreiber
          übernimmt keine Haftung für Entscheidungen, die auf Basis dieser automatisiert erstellten
          Inhalte getroffen werden.
        </p>
        <p className="mb-3">
          Ein „Verifiziert&rdquo;-Abzeichen bestätigt lediglich, dass der Nutzer zum Zeitpunkt der Prüfung von
          ihm hochgeladene Dokumente (z. B. Gewerbeanmeldung, Qualifikationsnachweis, Nachweis einer
          Haftpflichtversicherung) vorgelegt hat. Es stellt keine Garantie für deren fortlaufende
          Gültigkeit, für die tatsächliche fachliche Qualifikation oder für die Vertragstreue des
          jeweiligen Unternehmers dar; der Betreiber übernimmt hierfür keine Haftung.
        </p>
        <p className="mb-3">
          Für Schäden, die auf einer nur leicht fahrlässigen Pflichtverletzung des Betreibers beruhen,
          haftet der Betreiber nur bei Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht) und
          in diesem Fall begrenzt auf den vertragstypisch vorhersehbaren Schaden. Die vorstehenden
          Haftungsbeschränkungen gelten nicht bei Vorsatz oder grober Fahrlässigkeit, bei der Verletzung
          von Leben, Körper oder Gesundheit, bei arglistig verschwiegenen Mängeln, bei Übernahme einer
          Garantie sowie bei zwingender gesetzlicher Haftung (z. B. nach dem Produkthaftungsgesetz).
        </p>
        <p>
          Der Betreiber übernimmt keine Haftung für die ständige Verfügbarkeit, Fehlerfreiheit oder
          Sicherheit der Plattform sowie für Ausfälle, die auf höherer Gewalt, Wartungsarbeiten oder dem
          Verschulden Dritter (z. B. Hosting- oder Zahlungsdienstleister) beruhen.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 8 Schlussbestimmungen</h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>
    </div>
    <SiteFooter />
    </>
  )
}
