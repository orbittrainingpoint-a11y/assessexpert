// Server-side CMS reader for the marketing site. Fetches published
// content from the backend's PUBLIC (unauthenticated) CMS endpoints and
// merges it over the bundled defaults so a missing field or an
// unreachable backend never blanks the page. Used only in Server
// Components (SSR/ISR) for SEO.

import { HOME, PAGE_CONTENT, PAGE_META, type HomeContent, type MarketingPageContent, type PageMeta } from './marketing-content'

// Server-to-server base URL. In production behind the Apache reverse
// proxy this can stay localhost; client code uses NEXT_PUBLIC_API_URL.
const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')

// Revalidate cached CMS responses every 60s (ISR). Editors see changes
// within a minute without a redeploy.
const REVALIDATE = 60

async function cmsFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate: REVALIDATE } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null // backend down → fall back to bundled defaults
  }
}

interface CmsPageRow {
  slug: string
  title?: string
  content?: Partial<HomeContent & MarketingPageContent> & Record<string, unknown>
  metaTitle?: string | null
  metaDescription?: string | null
  ogImage?: string | null
  keywords?: string[]
}

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  body?: string
  coverImage?: string | null
  tags: string[]
  authorName?: string | null
  publishedAt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  keywords?: string[]
}

/**
 * Extract Q&A pairs from a sanitized blog body for FAQPage JSON-LD.
 *
 * Posts mark their FAQ block with `<h2>FAQ</h2>` (or `<h2 id="faq">`).
 * After that heading, each `<h3>Question</h3>` followed by a `<p>Answer</p>`
 * is captured. Stops at the next `<h2>` so post-FAQ sections (CTA, etc.)
 * are not pulled in.
 *
 * Returning an empty array means no schema is emitted — safer than a
 * malformed FAQPage that confuses search engines.
 */
export function extractFaqsFromBody(body: string): { question: string; answer: string }[] {
  if (!body) return []
  // Slice out the FAQ block: from the FAQ heading to the next H2.
  const faqHeadingMatch = body.match(/<h2[^>]*>\s*FAQ[^<]*<\/h2>/i)
  if (!faqHeadingMatch || faqHeadingMatch.index === undefined) return []
  const afterFaq = body.slice(faqHeadingMatch.index + faqHeadingMatch[0].length)
  const nextH2 = afterFaq.search(/<h2[\s>]/i)
  const faqBlock = nextH2 === -1 ? afterFaq : afterFaq.slice(0, nextH2)

  const items: { question: string; answer: string }[] = []
  // Pattern: <h3>Question</h3> <p>Answer</p>
  const pairRegex = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = pairRegex.exec(faqBlock)) !== null) {
    const question = m[1].replace(/<[^>]+>/g, '').trim()
    const answer = m[2].replace(/<[^>]+>/g, '').trim()
    if (question && answer) items.push({ question, answer })
  }
  return items
}

/** Resolve SEO metadata for a page: CMS overrides → bundled default. */
export async function getPageMeta(slug: string): Promise<PageMeta & { ogImage?: string | null }> {
  const fallback = PAGE_META[slug] ?? PAGE_META.home
  const row = await cmsFetch<CmsPageRow>(`/cms/public/pages/${slug}`)
  if (!row) return fallback
  return {
    metaTitle: row.metaTitle || fallback.metaTitle,
    metaDescription: row.metaDescription || fallback.metaDescription,
    keywords: row.keywords?.length ? row.keywords : fallback.keywords,
    ogImage: row.ogImage,
  }
}

/** Home content: bundled defaults with any CMS-provided fields layered on top. */
export async function getHomeContent(): Promise<HomeContent> {
  const row = await cmsFetch<CmsPageRow>('/cms/public/pages/home')
  if (!row?.content) return HOME
  const c = row.content
  return {
    ...HOME,
    label: (c.label as string) || HOME.label,
    heroBadge: (c.heroBadge as string) || HOME.heroBadge,
    heroTitle: (c.heroTitle as string) || HOME.heroTitle,
    heroHighlight: (c.heroHighlight as string) || HOME.heroHighlight,
    heroSubtitle: (c.heroSubtitle as string) || HOME.heroSubtitle,
    heroBadges: c.heroBadges?.length ? c.heroBadges : HOME.heroBadges,
    stats: c.stats?.length ? c.stats : HOME.stats,
    features: c.features?.length ? c.features : HOME.features,
    process: c.process?.length ? c.process : HOME.process,
    industries: c.industries?.length ? c.industries : HOME.industries,
    trust: c.trust?.length ? c.trust : HOME.trust,
    ctaTitle: (c.ctaTitle as string) || HOME.ctaTitle,
    ctaSubtitle: (c.ctaSubtitle as string) || HOME.ctaSubtitle,
  }
}

/** Copy for non-home marketing routes: published CMS values over bundled defaults. */
export async function getMarketingPageContent(slug: keyof typeof PAGE_CONTENT): Promise<MarketingPageContent> {
  const fallback = PAGE_CONTENT[slug]
  const row = await cmsFetch<CmsPageRow>(`/cms/public/pages/${slug}`)
  if (!row?.content) return fallback
  const content = row.content
  return Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => [key, typeof content[key] === 'string' && content[key] ? content[key] : value]),
  ) as unknown as MarketingPageContent
}

export async function getPosts(): Promise<BlogPost[]> {
  const posts = await cmsFetch<BlogPost[]>('/cms/public/posts')
  return posts ?? []
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  return cmsFetch<BlogPost>(`/cms/public/posts/${encodeURIComponent(slug)}`)
}

// ── Dynamic service pages (SEO landing pages) ────────────────────────
// These are seeded via prisma/cms-seed/run.ts with a rich content shape
// that the /services/[slug] route renders. Editors can override copy in
// the CMS without a code deploy.

export interface ServicePageContent {
  heroBadge: string
  heroTitle: string
  heroHighlight: string
  heroSubtitle: string
  intro: string
  sections: { title: string; body: string }[]
  features: { title: string; description: string }[]
  faqs: { question: string; answer: string }[]
  ctaTitle: string
  ctaSubtitle: string
}

export interface ServicePage {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  keywords: string[]
  content: ServicePageContent
}

/**
 * List every PUBLISHED CMS page slug. Powers the dynamic sitemap so it
 * doesn't depend on the hardcoded SERVICE_PAGE_SLUGS constant —
 * publishing a new page in /cms makes it appear in /sitemap.xml on
 * the next revalidation tick.
 *
 * `kind` is the backend's discriminator: `top` for top-level routes
 * (home/about/services/contact/blog → rendered at /<slug>), `service`
 * for service-page-shaped rows (rendered at /services/<slug>).
 */
export interface PublicPageEntry {
  slug: string
  title: string
  updatedAt: string
  kind: 'top' | 'service'
}

export async function listPublicPages(): Promise<PublicPageEntry[]> {
  const rows = await cmsFetch<PublicPageEntry[]>('/cms/public/pages')
  return rows ?? []
}

export async function getServicePage(slug: string): Promise<ServicePage | null> {
  const row = await cmsFetch<CmsPageRow>(`/cms/public/pages/${encodeURIComponent(slug)}`)
  if (!row?.content) return null
  const c = row.content as Partial<ServicePageContent>
  // Require the shape that distinguishes a service page from a generic
  // CMS page — if `intro` / `sections` are missing the slug is something
  // else (e.g. the bundled home/about row) and we should 404.
  if (typeof c.intro !== 'string' || !Array.isArray(c.sections)) return null
  return {
    slug: row.slug,
    title: row.title || slug,
    metaTitle: row.metaTitle || row.title || slug,
    metaDescription: row.metaDescription || '',
    keywords: row.keywords || [],
    content: {
      heroBadge: c.heroBadge || '',
      heroTitle: c.heroTitle || row.title || '',
      heroHighlight: c.heroHighlight || '',
      heroSubtitle: c.heroSubtitle || '',
      intro: c.intro || '',
      sections: c.sections || [],
      features: c.features || [],
      faqs: c.faqs || [],
      ctaTitle: c.ctaTitle || 'Talk to our team',
      ctaSubtitle: c.ctaSubtitle || '',
    },
  }
}
