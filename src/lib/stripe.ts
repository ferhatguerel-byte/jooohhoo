import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-06-24.dahlia',
})

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    priceId: process.env.STRIPE_PRICE_STARTER!,
    features: ['5 Projekte', '10GB Speicher', 'E-Mail Support', 'API Zugang'],
    popular: false,
  },
  pro: {
    name: 'Pro',
    price: 79,
    priceId: process.env.STRIPE_PRICE_PRO!,
    features: ['Unbegrenzte Projekte', '100GB Speicher', 'Priority Support', 'API Zugang', 'Automatisierungen', 'Analytics'],
    popular: true,
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    priceId: process.env.STRIPE_PRICE_ENTERPRISE!,
    features: ['Alles in Pro', 'Dedizierter Account Manager', 'SLA Garantie', 'Custom Integrationen', 'White-Label', 'Team Management'],
    popular: false,
  },
}
