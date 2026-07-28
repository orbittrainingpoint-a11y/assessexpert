import type { MetadataRoute } from 'next'
import { getPosts, listPublicPages } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'
import { MANPOWER_ROLE_SLUGS, fromManpowerDbSlug } from '@/lib/manpower-roles'

// Fully dynamic sitemap — every entry is data-driven, nothing
// hardcoded. Top-level routes, service landing pages, and blog posts
// are all pulled from the CMS at request time. Publishing a new page
// or post in /cms makes it appear in /sitemap.xml on the next
// revalidation tick — no code change required.
//
// Blog cover images are included as `images: [...]` per post so the
// Next.js sitemap generator emits xmlns:image entries — these surface
// in Google Images and OG previews. Service pages don't have hero
// images yet; when they do, add them the same way.
//
// Revalidate window: 5 minutes. Strikes a balance between freshness
// (newly-published content appears quickly) and load (sitemap fetches
// the CMS list endpoints on every cold revalidation).
export const revalidate = 300

// Fallback list — used only when the CMS is unreachable. Mirrors the
// known top-level marketing routes so the sitemap is never empty on a
// transient backend outage. The CMS-driven list takes priority on
// success.
const FALLBACK_TOP = ['home', 'about', 'services', 'manpower', 'contact', 'blog'] as const

function topLevelUrl(base: string, slug: string): string {
  return slug === 'home' ? `${base}/` : `${base}/${slug}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url
  const now = new Date()

  // Pull everything in parallel — we don't need to await sequentially.
  const [pages, posts] = await Promise.all([
    listPublicPages().catch(() => []),
    getPosts().catch(() => []),
  ])

  // Top-level pages. Prefer the CMS list; fall back to the static
  // catalogue if the CMS returned nothing (cold start, backend down).
  const topPagesFromCms = pages.filter((p) => p.kind === 'top')
  const topPages = topPagesFromCms.length > 0
    ? topPagesFromCms
    : FALLBACK_TOP.map((slug) => ({ slug, title: slug, updatedAt: now.toISOString(), kind: 'top' as const }))

  // Priority / changeFrequency map — search engines treat these as
  // hints, not commitments. We bias toward higher priority for the
  // homepage + services + blog index because those drive most paid
  // and organic landings.
  const topPriority: Record<string, { p: number; cf: MetadataRoute.Sitemap[number]['changeFrequency'] }> = {
    home: { p: 1, cf: 'weekly' },
    services: { p: 0.9, cf: 'monthly' },
    manpower: { p: 0.9, cf: 'monthly' },
    blog: { p: 0.8, cf: 'weekly' },
    about: { p: 0.7, cf: 'monthly' },
    contact: { p: 0.6, cf: 'yearly' },
  }

  const topRoutes: MetadataRoute.Sitemap = topPages.map((p) => {
    const meta = topPriority[p.slug] || { p: 0.5, cf: 'monthly' as const }
    return {
      url: topLevelUrl(base, p.slug),
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: meta.cf,
      priority: meta.p,
    }
  })

  // Service landing pages — entirely CMS-driven. A new
  // /services/<slug> appears as soon as the CMS row exists with a
  // service-page-shaped content payload (intro + sections).
  const serviceRoutes: MetadataRoute.Sitemap = pages
    .filter((p) => p.kind === 'service')
    .map((p) => ({
      url: `${base}/services/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.85,
    }))

  // Blog posts — image entries enable Google Images discovery + nicer
  // OG previews. Cover images are SVGs served by the dynamic
  // /blog-cover/<slug> route, promoted to absolute URLs here.
  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => {
    const coverAbs = p.coverImage
      ? (p.coverImage.startsWith('http') ? p.coverImage : `${base}${p.coverImage}`)
      : undefined
    return {
      url: `${base}/blog/${p.slug}`,
      lastModified: p.publishedAt ? new Date(p.publishedAt) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
      ...(coverAbs ? { images: [coverAbs] } : {}),
    }
  })

  // Manpower role landing pages. Prefer live CMS rows so newly seeded
  // roles appear immediately; fall back to the compiled catalogue on
  // cold start / backend outage so the sitemap never loses the whole
  // service line.
  const manpowerFromCms = pages
    .filter((p) => p.kind === 'manpower')
    .map((p) => ({ role: fromManpowerDbSlug(p.slug), updatedAt: p.updatedAt }))
    .filter((r): r is { role: string; updatedAt: string } => !!r.role)
  const manpowerEntries = manpowerFromCms.length > 0
    ? manpowerFromCms
    : MANPOWER_ROLE_SLUGS.map((role) => ({ role, updatedAt: now.toISOString() }))
  const manpowerRoutes: MetadataRoute.Sitemap = manpowerEntries.map((r) => ({
    url: `${base}/manpower/${r.role}`,
    lastModified: r.updatedAt ? new Date(r.updatedAt) : now,
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  return [...topRoutes, ...serviceRoutes, ...manpowerRoutes, ...postRoutes]
}
