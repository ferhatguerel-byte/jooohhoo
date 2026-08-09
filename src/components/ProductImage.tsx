import { Lamp, Sun, Leaf, Lightbulb, PanelTop } from 'lucide-react'
import type { Product } from '@/lib/products'

const ICONS = {
  lamp: Lamp,
  sun: Sun,
  leaf: Leaf,
  clip: Lightbulb,
  panel: PanelTop,
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
