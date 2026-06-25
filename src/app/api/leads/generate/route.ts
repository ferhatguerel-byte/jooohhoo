import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const GEWERKE = ['Bauunternehmen', 'Generalunternehmer', 'Hausverwaltung', 'Immobilienverwaltung', 'Architekt', 'Bauträger', 'Handwerksbetrieb', 'Malerbetrieb', 'Dachdecker', 'Trockenbauer', 'Estrichfirma']
const CITIES = ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Hannover', 'Nürnberg', 'Duisburg', 'Bochum']
const FIRST = ['Thomas', 'Michael', 'Stefan', 'Andreas', 'Klaus', 'Peter', 'Hans', 'Maria', 'Sandra', 'Petra', 'Markus', 'Frank']
const LAST = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Bauer', 'Wolf']
const SUFFIX = ['Bau GmbH', 'Bauträger AG', 'Immobilien GmbH', 'Baugesellschaft mbH', 'Hochbau GmbH', 'Services GmbH']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

export async function POST(req: NextRequest) {
  const { count = 10 } = await req.json()
  let imported = 0
  for (let i = 0; i < Math.min(count, 50); i++) {
    const last = pick(LAST)
    const first = pick(FIRST)
    const company = `${last} ${pick(SUFFIX)}`
    const city = pick(CITIES)
    const gewerk = pick(GEWERKE)
    const domain = company.toLowerCase().split(' ')[0].replace(/[äöü]/g, x => ({ ä: 'ae', ö: 'oe', ü: 'ue' }[x] || x)) + '.de'
    db.createLead({
      company_name: company,
      contact_name: `${first} ${last}`,
      email: `info@${domain}`,
      phone: `0${Math.floor(30 + Math.random() * 70)} ${Math.floor(1000000 + Math.random() * 9000000)}`,
      city,
      gewerk,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      review_count: Math.floor(5 + Math.random() * 200),
      source: 'demo',
      status: 'neu',
    })
    imported++
  }
  return NextResponse.json({ imported })
}
