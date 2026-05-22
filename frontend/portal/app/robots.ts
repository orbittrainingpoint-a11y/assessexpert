import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/marketing-content'

// Public marketing routes are crawlable; the authenticated app surfaces
// and candidate exam flow are not (no SEO value, and we don't want them
// indexed).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/services', '/about', '/contact', '/blog'],
      disallow: ['/login', '/exam', '/tech-check', '/cms', '/admin', '/hr', '/proctor', '/master-proctor', '/exam-setup', '/sales', '/accept-invitation'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  }
}
