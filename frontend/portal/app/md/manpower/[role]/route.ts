// GET /md/manpower/<role>
//
// Markdown twin of /manpower/<role>. Same shape as /md/services/<slug>
// — the CMS row for a manpower role uses the same ServicePageContent
// structure, so we route through renderServicePageMd. Header CTA lines
// are unchanged; the canonical URL points at the HTML page.

import { NextRequest } from 'next/server'
import { getManpowerPage } from '@/lib/cms'
import { renderServicePageMd } from '@/lib/to-markdown'
import { MANPOWER_ROLE_SLUGS } from '@/lib/manpower-roles'
import { SITE } from '@/lib/marketing-content'

export const revalidate = 60

export function generateStaticParams() {
  return MANPOWER_ROLE_SLUGS.map((role) => ({ role }))
}

type Ctx = { params: Promise<{ role: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { role } = await ctx.params
  const page = await getManpowerPage(role)
  if (!page) {
    return new Response(`# Not found\n\nNo manpower role with slug \`${role}\`.\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  }
  // Render with the same emitter but override the canonical URL so it
  // points at /manpower/<role> instead of /services/<slug>. The
  // renderer uses SITE.url + '/services/' + page.slug internally, so
  // rewrite that suffix in the emitted body.
  const raw = renderServicePageMd({
    title: page.title,
    slug: page.slug,
    metaDescription: page.metaDescription,
    content: page.content,
  })
  const md = raw.replace(
    `${SITE.url}/services/${page.slug}`,
    `${SITE.url}/manpower/${role}`,
  )
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
