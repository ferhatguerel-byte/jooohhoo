import { describe, it, expect } from 'vitest'
import { filterProviderForJob, type HardFilterJob, type HardFilterProvider } from '@/lib/matching/hard-filter'

const baseJob: HardFilterJob = {
  gewerk: 'Elektro',
  plz: '10115', // Berlin
  budgetMin: null,
  budgetMax: null,
}

const baseProvider: HardFilterProvider = {
  gewerke: ['Elektro'],
  blockedGewerke: [],
  verifiedGewerke: ['Elektro'],
  accountStatus: 'active',
  subscriptionStatus: 'active',
  plz: '10115',
  serviceRadiusKm: null,
  minProjectSize: null,
  maxProjectSize: null,
}

describe('filterProviderForJob — Hard Filter (Phase 3.3)', () => {
  it('1. falsches Gewerk → gewerk_mismatch', () => {
    const provider = { ...baseProvider, gewerke: ['Fliesenleger'] }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: false, exclusionReason: 'gewerk_mismatch' })
  })

  it('2. passendes Gewerk (sonst nichts Auffälliges) → eligible', () => {
    expect(filterProviderForJob(baseJob, baseProvider)).toEqual({ eligible: true })
  })

  it('3. gesperrtes Gewerk → blocked_gewerk', () => {
    const provider = { ...baseProvider, blockedGewerke: ['Elektro'] }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: false, exclusionReason: 'blocked_gewerk' })
  })

  it('4. inaktiver Account → account_inactive', () => {
    const provider: HardFilterProvider = { ...baseProvider, accountStatus: 'suspended' }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: false, exclusionReason: 'account_inactive' })
  })

  it('5. aktives Abo (sonst nichts Auffälliges) → eligible', () => {
    const provider: HardFilterProvider = { ...baseProvider, subscriptionStatus: 'active' }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: true })
  })

  it('6. kein aktives Abo → subscription_inactive', () => {
    const provider: HardFilterProvider = { ...baseProvider, subscriptionStatus: 'inactive' }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: false, exclusionReason: 'subscription_inactive' })
  })

  it('7. Meisterpflicht + nicht verifiziert → missing_master_qualification', () => {
    const provider = { ...baseProvider, verifiedGewerke: [] }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: false, exclusionReason: 'missing_master_qualification' })
  })

  it('8. Meisterpflicht + verifiziert → eligible', () => {
    const provider = { ...baseProvider, verifiedGewerke: ['Elektro'] }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: true })
  })

  it('9. nicht meisterpflichtiges Gewerk, keine Verifizierung nötig → eligible', () => {
    const job: HardFilterJob = { ...baseJob, gewerk: 'Fliesenleger' }
    const provider = { ...baseProvider, gewerke: ['Fliesenleger'], verifiedGewerke: [] }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('10. Radius innerhalb → eligible', () => {
    // Berlin (10115) → München (80331): ~500km laut estimatePlzDistanceKm-Zonenmodell
    const job: HardFilterJob = { ...baseJob, plz: '80331' }
    const provider = { ...baseProvider, plz: '10115', serviceRadiusKm: 1000 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('11. Radius außerhalb → out_of_radius', () => {
    const job: HardFilterJob = { ...baseJob, plz: '80331' }
    const provider = { ...baseProvider, plz: '10115', serviceRadiusKm: 10 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'out_of_radius' })
  })

  it('12. Radius NULL (keine Angabe) → kein Ausschluss trotz großer Entfernung', () => {
    const job: HardFilterJob = { ...baseJob, plz: '80331' }
    const provider = { ...baseProvider, plz: '10115', serviceRadiusKm: null }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('13. unbekannte PLZ-Distanz → kein Ausschluss (nicht wegen fehlender Geodaten ablehnen)', () => {
    const job: HardFilterJob = { ...baseJob, plz: '00000' } // keine bekannte PLZ-Zone
    const provider = { ...baseProvider, plz: '10115', serviceRadiusKm: 5 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('14. Projektgröße innerhalb → eligible', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: 20000, budgetMax: 50000 }
    const provider = { ...baseProvider, minProjectSize: 10000, maxProjectSize: 100000 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('15. Projektgröße außerhalb → project_size_mismatch', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: 10000, budgetMax: 30000 }
    const provider = { ...baseProvider, minProjectSize: 50000, maxProjectSize: 100000 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'project_size_mismatch' })
  })

  it('16. Job-Budget NULL → kein Ausschluss aufgrund Projektgröße', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: null, budgetMax: null }
    const provider = { ...baseProvider, minProjectSize: 50000, maxProjectSize: 100000 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('17. Provider min/max NULL → kein Ausschluss aufgrund Projektgröße', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: 10000, budgetMax: 30000 }
    const provider = { ...baseProvider, minProjectSize: null, maxProjectSize: null }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('18. nur Provider-Min gesetzt, Job passt nicht → project_size_mismatch', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: 5000, budgetMax: 10000 }
    const provider = { ...baseProvider, minProjectSize: 50000, maxProjectSize: null }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'project_size_mismatch' })
  })

  it('18b. nur Provider-Min gesetzt, Job passt → eligible', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: 60000, budgetMax: null }
    const provider = { ...baseProvider, minProjectSize: 50000, maxProjectSize: null }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('19. nur Provider-Max gesetzt, Job passt nicht → project_size_mismatch', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: 200000, budgetMax: 300000 }
    const provider = { ...baseProvider, minProjectSize: null, maxProjectSize: 100000 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'project_size_mismatch' })
  })

  it('19b. nur Provider-Max gesetzt, Job passt → eligible', () => {
    const job: HardFilterJob = { ...baseJob, budgetMin: null, budgetMax: 40000 }
    const provider = { ...baseProvider, minProjectSize: null, maxProjectSize: 100000 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: true })
  })

  it('20. mehrere Filter gleichzeitig verletzt → deterministisch der zuerst geprüfte Grund (gewerk_mismatch vor allem anderen)', () => {
    const provider: HardFilterProvider = {
      gewerke: ['Fliesenleger'], // Gewerk-Mismatch
      blockedGewerke: ['Elektro'], // zusätzlich gesperrt
      verifiedGewerke: [], // zusätzlich nicht verifiziert
      accountStatus: 'suspended', // zusätzlich gesperrter Account
      subscriptionStatus: 'inactive', // zusätzlich kein Abo
      plz: '10115',
      serviceRadiusKm: 1,
      minProjectSize: 999999,
      maxProjectSize: 999999,
    }
    const job: HardFilterJob = { ...baseJob, plz: '80331', budgetMin: 1, budgetMax: 1 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'gewerk_mismatch' })
  })

  it('20b. Priorität: blocked_gewerk vor missing_master_qualification, wenn Gewerk selbst passt', () => {
    const provider: HardFilterProvider = {
      ...baseProvider,
      blockedGewerke: ['Elektro'],
      verifiedGewerke: [], // würde ebenfalls zum Ausschluss führen
    }
    expect(filterProviderForJob(baseJob, provider)).toEqual({ eligible: false, exclusionReason: 'blocked_gewerk' })
  })

  it('20c. Priorität: account_inactive vor subscription_inactive/out_of_radius/project_size_mismatch', () => {
    const provider: HardFilterProvider = {
      ...baseProvider,
      accountStatus: 'suspended',
      subscriptionStatus: 'inactive',
      serviceRadiusKm: 1,
      plz: '10115',
    }
    const job: HardFilterJob = { ...baseJob, plz: '80331' }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'account_inactive' })
  })

  it('20d. Priorität: subscription_inactive vor out_of_radius/project_size_mismatch', () => {
    const provider: HardFilterProvider = {
      ...baseProvider,
      subscriptionStatus: 'inactive',
      serviceRadiusKm: 1,
      minProjectSize: 999999,
    }
    const job: HardFilterJob = { ...baseJob, plz: '80331', budgetMin: 1, budgetMax: 1 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'subscription_inactive' })
  })

  it('20e. Priorität: out_of_radius vor project_size_mismatch', () => {
    const provider: HardFilterProvider = {
      ...baseProvider,
      serviceRadiusKm: 1,
      minProjectSize: 999999,
      maxProjectSize: 999999,
    }
    const job: HardFilterJob = { ...baseJob, plz: '80331', budgetMin: 1, budgetMax: 1 }
    expect(filterProviderForJob(job, provider)).toEqual({ eligible: false, exclusionReason: 'out_of_radius' })
  })
})
