// GET /md/blog/<slug>
//
// Serves any published blog post as text/markdown. AI crawlers +
// answer engines prefer this format — smaller, structurally cleaner,
// unambiguous vs the React-rendered HTML at /blog/<slug>.
//
// The HTML page and this MD version share the same underlying CMS
// row (post.body is HTML we sanitise for HTML render; here we
// convert to markdown via TurndownService). Both are canonical to
// the same URL (`/blog/<slug>`) so search engines don't treat them
// as duplicates.

import { NextRequest } from 'next/server'
import { getPost } from '@/lib/cms'
import { renderBlogPostMd } from '@/lib/to-markdown'

export const revalidate = 60

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params
  const post = await getPost(slug)
  if (!post) {
    return new Response(`# Not found\n\nNo post with slug \`${slug}\`.\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  }
  const md = renderBlogPostMd({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    tags: post.tags,
    authorName: post.authorName,
    publishedAt: post.publishedAt,
    keywords: post.keywords,
  })
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Same ISR cadence as the HTML page. Editors see updates
      // within 60s.
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
