export type TierId = 'pro' | 'premium'

export interface TierDefinition {
  id: TierId
  name: string
  priceEuro: number
  leadsPerMonth: number
  features: string[]
  priceEnv: string
}

export const TIERS: Record<TierId, TierDefinition> = {
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

export const TIER_ORDER: TierId[] = ['pro', 'premium']
