import Stripe from 'stripe'

let stripeClient: Stripe | undefined

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_build_placeholder')
  }
  return stripeClient
}
