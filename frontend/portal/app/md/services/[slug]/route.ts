// GET /md/services/<slug>
//
// Serves any service landing page as text/markdown. Content is
// composed directly from the structured CMS shape (intro / sections /
// features / faqs) — no HTML→MD conversion needed for the container.
// Section bodies are HTML and get converted via TurndownService.
//
// Canonical URL points at the HTML version so search engines don't
// treat MD + HTML as duplicates.

import { NextRequest } from 'next/server'
import { getServicePage } from '@/lib/cms'
import { renderServicePageMd } from '@/lib/to-markdown'
import { SERVICE_PAGE_SLUGS } from '@/lib/service-slugs'

export const revalidate = 60

// Pre-render every service slug at build so the first crawl gets a
// static file (no cold render latency).
export function generateStaticParams() {
  return SERVICE_PAGE_SLUGS.map((slug) => ({ slug }))
}

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params
  const page = await getServicePage(slug)
  if (!page) {
    return new Response(`# Not found\n\nNo service page with slug \`${slug}\`.\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  }
  const md = renderServicePageMd({
    title: page.title,
    slug: page.slug,
    metaDescription: page.metaDescription,
    content: page.content,
  })
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
