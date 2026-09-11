export type TierId = 'basic' | 'pro' | 'premium'

export interface TierDefinition {
  id: TierId
  name: string
  priceEuro: number
  maxActiveJobs: number
  leadsPerMonth: number
  features: string[]
  priceEnv: string
}

export const TIERS: Record<TierId, TierDefinition> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    priceEuro: 49,
    maxActiveJobs: 2,
    leadsPerMonth: 5,
    features: ['2 aktive Aufträge gleichzeitig', '5 Subunternehmer-Kontakte pro Monat', 'E-Mail-Support'],
    priceEnv: 'STRIPE_PRICE_BASIC',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceEuro: 149,
    maxActiveJobs: 10,
    leadsPerMonth: 25,
    features: ['10 aktive Aufträge gleichzeitig', '25 Subunternehmer-Kontakte pro Monat', 'Priorisierter Support'],
    priceEnv: 'STRIPE_PRICE_PRO',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceEuro: 399,
    maxActiveJobs: 999,
    leadsPerMonth: 999,
    features: ['Unbegrenzte aktive Aufträge', 'Unbegrenzte Subunternehmer-Kontakte', 'Persönlicher Ansprechpartner'],
    priceEnv: 'STRIPE_PRICE_PREMIUM',
  },
}

export const TIER_ORDER: TierId[] = ['basic', 'pro', 'premium']
