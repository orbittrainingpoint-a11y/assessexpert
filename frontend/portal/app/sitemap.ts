import type { MetadataRoute } from 'next'
import { getPosts } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'
import { SERVICE_PAGE_SLUGS } from '@/lib/service-slugs'

// Dynamic sitemap: static marketing pages + every published blog post.
// Regenerated on the ISR window so newly published posts appear without
// a redeploy.
export const revalidate = 300

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ]

  const serviceRoutes: MetadataRoute.Sitemap = SERVICE_PAGE_SLUGS.map((slug) => ({
    url: `${base}/services/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  const posts = await getPosts()
  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticRoutes, ...serviceRoutes, ...postRoutes]
}
