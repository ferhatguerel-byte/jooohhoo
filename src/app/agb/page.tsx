import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'AGB – BAUVERSUS' }

export default function AgbPage() {
  return (
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
        <p>
          Unternehmer können zwischen verschiedenen, monatlich kündbaren Abo-Stufen wählen, die sich
          hinsichtlich der Anzahl monatlich kontaktierbarer Aufträge unterscheiden. Die jeweils aktuellen
          Preise und Leistungsumfänge sind auf der Website unter „Preise&rdquo; einsehbar. Nicht genutzte
          Kontingente verfallen zum Ende der Abrechnungsperiode und werden nicht in den Folgemonat
          übertragen.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 4 Zahlung und Kündigung</h2>
        <p>
          Die Abo-Gebühr wird monatlich im Voraus über den Zahlungsdienstleister Stripe abgebucht. Das Abo
          kann jederzeit zum Ende der laufenden Abrechnungsperiode über die Kontoverwaltung gekündigt
          werden. Bereits gezahlte Gebühren werden nicht anteilig erstattet.
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
        <h2 className="font-bold text-slate-900 mb-2">§ 6 Haftungsausschluss</h2>
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
        <h2 className="font-bold text-slate-900 mb-2">§ 7 Schlussbestimmungen</h2>
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen dieser AGB
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </section>

      <p className="text-sm text-slate-400">
        [Platzhalter-Text – vor Livegang durch rechtlich geprüfte, individuelle AGB für eine
        Vermittlungsplattform ersetzen, insbesondere hinsichtlich Haftungsausschluss, Widerrufsrecht bei
        Abo-Abschluss und Kündigungsmodalitäten.]
      </p>
    </div>
  )
}
