import Link from 'next/link'
import { notFound } from 'next/navigation'
import { COLLECTIONS, getProductsByCollection } from '@/lib/products'
import { ProductImage } from '@/components/ProductImage'

export default async function CollectionPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const collection = COLLECTIONS[handle as keyof typeof COLLECTIONS]
  if (!collection) notFound()

  const products = getProductsByCollection(handle)

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{collection.title}</h1>
        <p className="mt-3 text-black/60">{collection.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group block overflow-hidden rounded-lg border border-black/10 transition hover:border-black/30"
          >
            <ProductImage product={product} className="aspect-square w-full" />
            <div className="p-4">
              {product.badge && (
                <span className="mb-2 inline-block rounded-full bg-black px-2 py-0.5 text-xs font-medium text-white">
                  {product.badge}
                </span>
              )}
              <h2 className="font-medium leading-snug group-hover:underline">{product.name}</h2>
              <p className="mt-1 text-sm text-black/50">{product.tagline}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-semibold">{product.price.toFixed(2)}€</span>
                {product.compareAtPrice && (
                  <span className="text-sm text-black/40 line-through">{product.compareAtPrice.toFixed(2)}€</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
