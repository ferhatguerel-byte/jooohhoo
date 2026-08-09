import { notFound } from 'next/navigation'
import { getProductBySlug } from '@/lib/products'
import { ProductImage } from '@/components/ProductImage'
import { AddToCartButton } from './AddToCartButton'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) notFound()

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-12 md:grid-cols-2">
      <ProductImage product={product} className="aspect-square w-full rounded-lg" />

      <div>
        {product.badge && (
          <span className="mb-3 inline-block rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
            {product.badge}
          </span>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-black/60">{product.tagline}</p>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-2xl font-semibold">{product.price.toFixed(2)}€</span>
          {product.compareAtPrice && (
            <span className="text-black/40 line-through">{product.compareAtPrice.toFixed(2)}€</span>
          )}
        </div>

        <p className="mt-6 leading-relaxed text-black/70">{product.description}</p>

        <ul className="mt-6 space-y-2 text-sm">
          {product.features.map((f) => (
            <li key={f} className="flex gap-2">
              <span>✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <AddToCartButton productId={product.id} />
        </div>

        <div className="mt-10 border-t border-black/10 pt-6">
          <h2 className="mb-3 text-sm font-medium">Spezifikationen</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {product.specs.map((s) => (
              <div key={s.label} className="contents">
                <dt className="text-black/50">{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
