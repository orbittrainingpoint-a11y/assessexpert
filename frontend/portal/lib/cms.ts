// Server-side CMS reader for the marketing site. Fetches published
// content from the backend's PUBLIC (unauthenticated) CMS endpoints and
// merges it over the bundled defaults so a missing field or an
// unreachable backend never blanks the page. Used only in Server
// Components (SSR/ISR) for SEO.

import { HOME, PAGE_META, type HomeContent, type PageMeta } from './marketing-content'

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
  content?: Partial<HomeContent> & Record<string, unknown>
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
  }
}

export async function getPosts(): Promise<BlogPost[]> {
  const posts = await cmsFetch<BlogPost[]>('/cms/public/posts')
  return posts ?? []
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  return cmsFetch<BlogPost>(`/cms/public/posts/${encodeURIComponent(slug)}`)
}
