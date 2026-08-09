'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { PRODUCTS } from '@/lib/products'
import { ProductImage } from '@/components/ProductImage'

export default function CartPage() {
  const { lines, setQuantity, removeItem, subtotal, itemCount } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = lines
    .map((l) => ({ line: l, product: PRODUCTS.find((p) => p.id === l.productId) }))
    .filter((x) => x.product)

  async function checkout() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout fehlgeschlagen')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout fehlgeschlagen')
      setLoading(false)
    }
  }

  if (itemCount === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold">Dein Warenkorb ist leer</h1>
        <Link href="/collections/grow-lights" className="mt-4 inline-block underline">
          Weiter shoppen
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold">Warenkorb</h1>

      <div className="divide-y divide-black/10 border-y border-black/10">
        {items.map(({ line, product }) => (
          <div key={line.productId} className="flex items-center gap-4 py-4">
            <ProductImage product={product!} className="h-20 w-20 shrink-0 rounded-md" />
            <div className="flex-1">
              <p className="font-medium">{product!.name}</p>
              <p className="text-sm text-black/50">{product!.price.toFixed(2)}€</p>
            </div>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
              className="w-16 rounded border border-black/20 px-2 py-1 text-center"
            />
            <button onClick={() => removeItem(line.productId)} className="text-sm text-black/50 underline">
              Entfernen
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between text-lg font-semibold">
        <span>Zwischensumme</span>
        <span>{subtotal.toFixed(2)}€</span>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        onClick={checkout}
        disabled={loading}
        className="mt-6 w-full rounded-md bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-black/80 disabled:opacity-50"
      >
        {loading ? 'Weiterleitung…' : 'Zur Kasse'}
      </button>
    </div>
  )
}
