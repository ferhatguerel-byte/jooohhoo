import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { sendWelcomeEmail, sendPaymentConfirmation, sendAffiliateCommissionEmail } from '@/lib/email'
import { activeSupplier } from '@/lib/suppliers'
import { PRODUCTS } from '@/lib/products'
import Stripe from 'stripe'

async function handleShopOrder(session: Stripe.Checkout.Session) {
  if (db.getOrderByStripeSession(session.id)) return

  const cartMeta = session.metadata?.cart || ''
  const items = cartMeta
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [productId, qty] = entry.split(':')
      const product = PRODUCTS.find((p) => p.id === productId)
      return product ? { product, quantity: Number(qty) || 1 } : null
    })
    .filter((x): x is { product: (typeof PRODUCTS)[number]; quantity: number } => x !== null)

  if (!items.length) return

  const shipping = session.collected_information?.shipping_details ?? null
  const addressParts = shipping?.address
  const shippingAddressText = [
    shipping?.name,
    addressParts?.line1,
    addressParts?.line2,
    addressParts?.postal_code,
    addressParts?.city,
    addressParts?.country,
  ]
    .filter(Boolean)
    .join(', ')

  const subtotal = (session.amount_total || 0) / 100
  const email = session.customer_details?.email || session.customer_email || ''

  const order = db.createOrder({
    stripeSessionId: session.id,
    customerEmail: email,
    customerName: shipping?.name || undefined,
    shippingAddress: shippingAddressText,
    subtotal,
    currency: session.currency || 'eur',
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      supplierVariantId: product.supplierVariantId,
      name: product.name,
      quantity,
      unitPrice: product.price,
    })),
  })

  db.trackRevenue(new Date().toISOString().split('T')[0], subtotal, 'shop_order')
  await sendPaymentConfirmation(email, subtotal, 'Bestellung')

  const result = await activeSupplier.createOrder({
    orderId: order.id,
    items: items.map(({ product, quantity }) => ({ supplierVariantId: product.supplierVariantId, quantity })),
    shipping: {
      name: shipping?.name || '',
      email,
      phone: session.customer_details?.phone || undefined,
      line1: addressParts?.line1 || '',
      line2: addressParts?.line2 || undefined,
      city: addressParts?.city || '',
      postalCode: addressParts?.postal_code || '',
      country: addressParts?.country || '',
    },
  })

  db.updateOrderSupplierStatus(
    order.id,
    result.ok ? (result.mock ? 'mock_forwarded' : 'forwarded') : 'failed',
    result.supplierOrderId,
    result.error
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Ungültige Signatur' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.metadata?.order_type === 'shop_order') {
      await handleShopOrder(session)
      return NextResponse.json({ received: true })
    }

    const { name, planId, ref } = session.metadata || {}
    const email = session.customer_email || ''
    const amount = (session.amount_total || 0) / 100
    const affiliateCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const customer = db.createCustomer({
      email,
      name,
      stripeCustomerId: session.customer as string,
      plan: planId || 'starter',
      affiliateCode,
      referredBy: ref || undefined,
    })

    db.createPurchase({
      customerId: customer.id,
      productName: planId || 'starter',
      amount,
      stripeSessionId: session.id,
    })

    db.trackRevenue(new Date().toISOString().split('T')[0], amount, 'subscription')

    await sendWelcomeEmail(email, name || 'Kunde', planId || 'Starter', affiliateCode)
    await sendPaymentConfirmation(email, amount, planId || 'Starter')

    if (ref) {
      const affiliate = db.getCustomerByAffiliateCode(ref)
      if (affiliate) {
        const commissionAmount = Math.round(amount * 0.30 * 100) / 100
        db.createCommission({
          affiliateId: affiliate.id as string,
          referredEmail: email,
          purchaseAmount: amount,
          commissionAmount,
        })
        await sendAffiliateCommissionEmail(affiliate.email as string, commissionAmount, email)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    db.updateCustomerPlan(sub.customer as string, 'free', 'cancelled')
  }

  return NextResponse.json({ received: true })
}
