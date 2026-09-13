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

// Render on-demand rather than prerender-per-slug at build time.
// Fanning out to the backend for every slug during Next's 60s SSG
// window is unreliable on modest VPS hardware; the Cache-Control
// header below (60s public + 5 min stale-while-revalidate) still
// gives crawlers and AI systems a cached response almost every time.
export const dynamic = 'force-dynamic'
export const revalidate = 60

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
