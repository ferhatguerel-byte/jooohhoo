export type TierId = 'basic' | 'pro' | 'premium'

export interface TierDefinition {
  id: TierId
  name: string
  priceEuro: number
  leadsPerMonth: number
  features: string[]
  priceEnv: string
}

export const TIERS: Record<TierId, TierDefinition> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    priceEuro: 29,
    leadsPerMonth: 5,
    features: ['5 Aufträge pro Monat sehen & kontaktieren', 'Angebote abgeben', 'E-Mail-Support'],
    priceEnv: 'STRIPE_PRICE_BASIC',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceEuro: 79,
    leadsPerMonth: 25,
    features: ['25 Aufträge pro Monat sehen & kontaktieren', 'Angebote abgeben', 'Priorisierter Support'],
    priceEnv: 'STRIPE_PRICE_PRO',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceEuro: 149,
    leadsPerMonth: 999,
    features: ['Unbegrenzte Aufträge sehen & kontaktieren', 'Angebote abgeben', 'Persönlicher Ansprechpartner'],
    priceEnv: 'STRIPE_PRICE_PREMIUM',
  },
}

export const TIER_ORDER: TierId[] = ['basic', 'pro', 'premium']
