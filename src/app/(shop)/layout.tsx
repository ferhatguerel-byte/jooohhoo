import { CartProvider } from '@/lib/cart-context'
import { ShopNav } from '@/components/ShopNav'

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ShopNav />
      <main className="flex-1 bg-white text-black">{children}</main>
      <footer className="border-t border-black/10 bg-white px-6 py-8 text-center text-sm text-black/50">
        © {new Date().getFullYear()} Pawlenza · Versand mit CJ Dropshipping
      </footer>
    </CartProvider>
  )
}
