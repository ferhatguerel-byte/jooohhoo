import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { PRODUCTS } from '@/lib/products'

export async function POST(req: NextRequest) {
  try {
    const { lines } = (await req.json()) as { lines: { productId: string; quantity: number }[] }

    if (!lines?.length) {
      return NextResponse.json({ error: 'Warenkorb ist leer' }, { status: 400 })
    }

    const resolved = lines
      .map((l) => ({ line: l, product: PRODUCTS.find((p) => p.id === l.productId) }))
      .filter((x) => x.product && x.line.quantity > 0)

    if (!resolved.length) {
      return NextResponse.json({ error: 'Ungültiger Warenkorb' }, { status: 400 })
    }

    const line_items = resolved.map(({ line, product }) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: product!.name, description: product!.tagline },
        unit_amount: Math.round(product!.price * 100),
      },
      quantity: line.quantity,
    }))

    const cartMetadata = resolved.map(({ line }) => `${line.productId}:${line.quantity}`).join(',')

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: {
        allowed_countries: ['DE', 'AT', 'CH', 'NL', 'BE', 'FR', 'IT', 'ES'],
      },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/checkout/success`,
      cancel_url: `${origin}/cart`,
      metadata: {
        order_type: 'shop_order',
        cart: cartMetadata,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Shop checkout error', err)
    return NextResponse.json({ error: 'Checkout konnte nicht erstellt werden' }, { status: 500 })
  }
}
