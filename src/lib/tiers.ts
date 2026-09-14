export type TierId = 'monthly' | 'yearly'

export interface TierDefinition {
  id: TierId
  name: string
  priceEuroPerMonth: number
  minimumTermMonths: number
  billingNote: string
  leadsPerMonth: number
  features: string[]
  priceEnv: string
}

export const TIERS: Record<TierId, TierDefinition> = {
  monthly: {
    id: 'monthly',
    name: 'Monatspaket',
    priceEuroPerMonth: 119,
    minimumTermMonths: 0,
    billingNote: 'monatliche Abbuchung · jederzeit kündbar',
    leadsPerMonth: 999,
    features: ['Unbegrenzte Aufträge sehen & kontaktieren', 'Direkter Kontakt zu Auftraggebern', 'Angebote abgeben', 'Jederzeit monatlich kündbar'],
    priceEnv: 'STRIPE_PRICE_MONTHLY',
  },
  yearly: {
    id: 'yearly',
    name: 'Jahrespaket',
    priceEuroPerMonth: 89,
    minimumTermMonths: 12,
    billingNote: 'monatliche Abbuchung · 12 Monate Mindestlaufzeit',
    leadsPerMonth: 999,
    features: ['Unbegrenzte Aufträge sehen & kontaktieren', 'Direkter Kontakt zu Auftraggebern', 'Angebote abgeben', 'Günstigster Monatspreis'],
    priceEnv: 'STRIPE_PRICE_YEARLY',
  },
}

export const TIER_ORDER: TierId[] = ['monthly', 'yearly']
