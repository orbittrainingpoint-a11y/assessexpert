// /llms-full.txt — full-corpus aggregate for AI systems.
//
// llms.txt (the sibling file) is the index; this file is the payload.
// It concatenates every top-level page, every service page, and every
// published blog post as markdown in one fetch. AI answer engines that
// support llms-full.txt (Anthropic, OpenAI, Perplexity, others via the
// llmstxt.org convention) can ingest the whole site in a single
// request, which is dramatically cheaper for both sides than crawling.
//
// Canonical URLs point at the HTML pages so citations resolve to a
// human-readable destination.

import { SITE } from '@/lib/marketing-content'
import { getManpowerPage, getPost, getPosts, getServicePage, listPublicPages } from '@/lib/cms'
import {
  renderBlogPostMd,
  renderServicePageMd,
  renderTopPageMd,
} from '@/lib/to-markdown'
import { SERVICE_PAGE_SLUGS } from '@/lib/service-slugs'
import { MANPOWER_ROLE_SLUGS, fromManpowerDbSlug } from '@/lib/manpower-roles'

// Rebuild every 10 min. Full-corpus render is heavier than a single
// page, so we don't want it on every request; but staleness beyond
// 10 min for a full-site dump would misinform AI systems.
export const revalidate = 600

const TOP_SLUGS = ['home', 'about', 'services', 'manpower', 'contact', 'blog']

async function fetchTopPageRow(slug: string) {
  const API = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '')
  try {
    const res = await fetch(`${API}/cms/public/pages/${slug}`, { next: { revalidate: 600 } })
    if (!res.ok) return null
    return await res.json() as { slug: string; title?: string; content?: any; metaDescription?: string | null }
  } catch {
    return null
  }
}

export async function GET() {
  const url = SITE.url

  const [posts, pages] = await Promise.all([
    getPosts().catch(() => []),
    listPublicPages().catch(() => []),
  ])
  const cmsServiceSlugs = pages.filter((p) => p.kind === 'service').map((p) => p.slug)
  const serviceSlugs = cmsServiceSlugs.length ? cmsServiceSlugs : [...SERVICE_PAGE_SLUGS]

  const cmsManpowerRoles = pages
    .filter((p) => p.kind === 'manpower')
    .map((p) => fromManpowerDbSlug(p.slug))
    .filter((s): s is string => !!s)
  const manpowerRoles = cmsManpowerRoles.length ? cmsManpowerRoles : [...MANPOWER_ROLE_SLUGS]

  const header = [
    `# ${SITE.name} — full-site markdown corpus`,
    '',
    `> Single-file dump of every public marketing page and blog post on ${url}. Generated for AI answer engines that follow the llmstxt.org convention.`,
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Contact: ${SITE.email} | ${SITE.phone}`,
    `- Address: ${SITE.address}`,
    `- Machine index: ${url}/llms.txt`,
    `- Human sitemap: ${url}/sitemap.xml`,
    '',
    '---',
    '',
    '# Table of contents',
    '',
    '## Top-level pages',
    ...TOP_SLUGS.map((s) => `- ${s === 'home' ? url : `${url}/${s}`}`),
    '',
    `## Assessment service pages (${serviceSlugs.length})`,
    ...serviceSlugs.map((s) => `- ${url}/services/${s}`),
    '',
    `## Manpower role pages (${manpowerRoles.length})`,
    ...manpowerRoles.map((r) => `- ${url}/manpower/${r}`),
    '',
    `## Blog posts (${posts.length})`,
    ...posts.map((p) => `- ${url}/blog/${p.slug}`),
    '',
  ]

  const chunks: string[] = [header.join('\n')]

  // Top-level pages
  chunks.push('', '', '---', '', '# TOP-LEVEL PAGES', '')
  const topRows = await Promise.all(TOP_SLUGS.map((s) => fetchTopPageRow(s)))
  TOP_SLUGS.forEach((slug, i) => {
    const row = topRows[i]
    const md = renderTopPageMd({
      slug,
      title: row?.title || slug,
      metaDescription: row?.metaDescription || undefined,
      content: row?.content || {},
    })
    chunks.push('', '---', '', md)
  })

  // Service pages — fetch full ServicePage rows so we get intro/sections/features/faqs
  chunks.push('', '', '---', '', '# ASSESSMENT SERVICE LANDING PAGES', '')
  const services = await Promise.all(serviceSlugs.map((s) => getServicePage(s).catch(() => null)))
  services.forEach((page) => {
    if (!page) return
    chunks.push(
      '',
      '---',
      '',
      renderServicePageMd({
        title: page.title,
        slug: page.slug,
        metaDescription: page.metaDescription,
        content: page.content,
      }),
    )
  })

  // Manpower role pages — same content shape as services; rewrite the
  // canonical URL from /services/<db-slug> to /manpower/<role>.
  chunks.push('', '', '---', '', '# MANPOWER ROLE LANDING PAGES', '')
  const manpower = await Promise.all(manpowerRoles.map((r) => getManpowerPage(r).catch(() => null)))
  manpower.forEach((page, i) => {
    if (!page) return
    const raw = renderServicePageMd({
      title: page.title,
      slug: page.slug,
      metaDescription: page.metaDescription,
      content: page.content,
    })
    const role = manpowerRoles[i]
    const fixed = raw.replace(`${url}/services/${page.slug}`, `${url}/manpower/${role}`)
    chunks.push('', '---', '', fixed)
  })

  // Blog posts — full body each
  chunks.push('', '', '---', '', '# BLOG POSTS', '')
  const fullPosts = await Promise.all(posts.map((p) => getPost(p.slug).catch(() => null)))
  fullPosts.forEach((post) => {
    if (!post) return
    chunks.push(
      '',
      '---',
      '',
      renderBlogPostMd({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        body: post.body,
        tags: post.tags,
        authorName: post.authorName,
        publishedAt: post.publishedAt,
        keywords: post.keywords,
      }),
    )
  })

  return new Response(chunks.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600',
    },
  })
}
