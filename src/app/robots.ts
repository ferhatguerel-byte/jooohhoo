import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api'],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  }
}
