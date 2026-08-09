import { BedDouble, LayoutGrid, PawPrint, Bone, ShoppingBag } from 'lucide-react'
import type { Product } from '@/lib/products'

const ICONS = {
  bed: BedDouble,
  mat: LayoutGrid,
  paw: PawPrint,
  bone: Bone,
  bag: ShoppingBag,
}

export function ProductImage({ product, className }: { product: Product; className?: string }) {
  const Icon = ICONS[product.icon]
  return (
    <div
      className={`flex items-center justify-center ${className ?? ''}`}
      style={{ backgroundColor: product.color }}
    >
      <Icon className="h-16 w-16 text-black/60" strokeWidth={1.25} />
    </div>
  )
}
