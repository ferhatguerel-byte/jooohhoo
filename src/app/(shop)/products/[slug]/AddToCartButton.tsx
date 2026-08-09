'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/cart-context'

export function AddToCartButton({ productId }: { productId: string }) {
  const { addItem } = useCart()
  const [added, setAdded] = useState(false)
  const router = useRouter()

  return (
    <div className="flex gap-3">
      <button
        onClick={() => {
          addItem(productId)
          setAdded(true)
          setTimeout(() => setAdded(false), 1500)
        }}
        className="flex-1 rounded-md bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-black/80"
      >
        {added ? 'Hinzugefügt ✓' : 'In den Warenkorb'}
      </button>
      <button
        onClick={() => {
          addItem(productId)
          router.push('/cart')
        }}
        className="flex-1 rounded-md border border-black px-6 py-3 text-sm font-medium transition hover:bg-black/5"
      >
        Jetzt kaufen
      </button>
    </div>
  )
}
