'use client'

import Link from 'next/link'
import { PawPrint, ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/cart-context'

export function ShopNav() {
  const { itemCount } = useCart()

  return (
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/collections/hunde-komfort" className="flex items-center gap-2 font-semibold tracking-tight">
          <PawPrint className="h-5 w-5" />
          Pawlenza
        </Link>
        <nav className="hidden gap-8 text-sm sm:flex">
          <Link href="/collections/hunde-komfort" className="hover:opacity-70">Hunde-Komfort</Link>
          <Link href="/#kontakt" className="hover:opacity-70">Kontakt</Link>
        </nav>
        <Link href="/cart" className="relative flex items-center gap-2 text-sm">
          <ShoppingBag className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-medium text-white">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
