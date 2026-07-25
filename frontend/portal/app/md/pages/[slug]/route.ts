// GET /md/pages/<slug>
//
// Serves any top-level marketing page (home, about, services,
// contact, blog) as text/markdown. Content shape here is minimal
// (hero + intro + CTA) so the rendered MD is short — this is a
// summary-of-the-page more than a full page dump.

import { NextRequest } from 'next/server'
import { getPageMeta } from '@/lib/cms'
import { renderTopPageMd } from '@/lib/to-markdown'

// Which slugs are valid top-level pages. Matches the CmsPage rows
// seeded by backend/prisma/seed-cms.ts.
const TOP_SLUGS = new Set(['home', 'about', 'services', 'contact', 'blog'])

export const revalidate = 60

export function generateStaticParams() {
  return Array.from(TOP_SLUGS).map((slug) => ({ slug }))
}

type Ctx = { params: Promise<{ slug: string }> }

// Fetch the CMS row through the backend's public endpoint. We already
// have getPageMeta for SEO fields; for the fuller content shape we
// hit `/cms/public/pages/:slug` directly.
async function fetchCmsPage(slug: string) {
  const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
  try {
    const res = await fetch(`${API}/cms/public/pages/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return await res.json() as { slug: string; title?: string; content?: any; metaDescription?: string | null }
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params
  if (!TOP_SLUGS.has(slug)) {
    return new Response(`# Not found\n\nNo top-level page with slug \`${slug}\`.\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  }

  const [row, meta] = await Promise.all([
    fetchCmsPage(slug),
    getPageMeta(slug).catch(() => null),
  ])
  // Fall back to just meta if the row lookup failed. Better than 500.
  const md = renderTopPageMd({
    slug,
    title: row?.title || meta?.metaTitle || slug,
    metaDescription: row?.metaDescription || meta?.metaDescription || undefined,
    content: row?.content || {},
  })
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
