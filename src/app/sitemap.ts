import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.bauversus.de'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/registrieren`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/login`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/impressum`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/datenschutz`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/agb`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
