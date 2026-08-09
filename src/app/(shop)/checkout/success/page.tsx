import Link from 'next/link'

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Danke für deine Bestellung! 🌱</h1>
      <p className="mt-3 text-black/60">
        Du erhältst in Kürze eine Bestätigung per E-Mail. Deine Bestellung wird automatisch an unseren
        Lieferanten zur Versandabwicklung übergeben.
      </p>
      <Link href="/collections/grow-lights" className="mt-6 inline-block underline">
        Weiter shoppen
      </Link>
    </div>
  )
}
