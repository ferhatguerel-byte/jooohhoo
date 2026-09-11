import type { Metadata } from 'next'
import HomePage from '@/components/HomePage'

const TITLE = 'RundumWerk24 – Moving, Transport, Cleaning & Construction, All Under One Roof'
const DESCRIPTION =
  'RundumWerk24 is your all-in-one service provider in Germany for moving, transport, building cleaning and construction/renovation work. Fixed-price guarantee, insured, nationwide.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: '/en',
    languages: { de: '/', en: '/en' },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function Page() {
  return <HomePage locale="en" />
}
