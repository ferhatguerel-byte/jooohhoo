import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.rundumwerk24.de'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: { de: BASE_URL, en: `${BASE_URL}/en` } },
    },
    {
      url: `${BASE_URL}/en`,
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: { languages: { de: BASE_URL, en: `${BASE_URL}/en` } },
    },
    { url: `${BASE_URL}/impressum`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/datenschutz`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/agb`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
