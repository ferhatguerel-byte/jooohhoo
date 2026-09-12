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
          Handwerks- bzw. Subunternehmerbetrieben, die entsprechende Leistungen anbieten (gemeinsam
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
          Die Registrierung als Subunternehmer ist kostenlos. Die Registrierung als Auftraggeber ist
          kostenlos; die Einstellung von Aufträgen sowie die Freischaltung von Subunternehmer-Kontakten
          setzt ein aktives, kostenpflichtiges Abonnement voraus.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="font-bold text-slate-900 mb-2">§ 3 Abo-Modelle für Auftraggeber</h2>
        <p>
          Auftraggeber können zwischen verschiedenen, monatlich kündbaren Abo-Stufen wählen, die sich
          hinsichtlich der Anzahl gleichzeitig aktiver Aufträge sowie der Anzahl monatlich freischaltbarer
          Subunternehmer-Kontakte unterscheiden. Die jeweils aktuellen Preise und Leistungsumfänge sind auf
          der Website unter „Preise“ einsehbar. Nicht genutzte Kontingente verfallen zum Ende der
          Abrechnungsperiode und werden nicht in den Folgemonat übertragen.
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
        <h2 className="font-bold text-slate-900 mb-2">§ 6 Haftung</h2>
        <p>
          Der Betreiber übernimmt keine Gewähr für die Richtigkeit der von Nutzern eingestellten Inhalte,
          die Bonität oder Qualifikation der Nutzer sowie für den erfolgreichen Abschluss oder die
          ordnungsgemäße Durchführung von Verträgen zwischen Auftraggebern und Subunternehmern. Für Schäden
          aus der Durchführung vermittelter Aufträge haftet ausschließlich das jeweils beauftragte
          Unternehmen.
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
