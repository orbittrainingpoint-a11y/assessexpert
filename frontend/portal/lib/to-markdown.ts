// Markdown emitters for the /md/* routes.
//
// AI crawlers and answer engines increasingly prefer markdown to
// HTML — it's smaller, structurally cleaner, and unambiguous to
// parse. We already have every piece of marketing content in the
// CMS in structured form; this module renders it as markdown so an
// AI can grab a canonical, human-readable copy of any page without
// having to strip our React shell.
//
// Three shapes are supported:
//
//   1. Blog posts — body is HTML we sanitise; TurndownService
//      converts it verbatim with sensible defaults for our
//      limited tag set (p, h2, h3, ul/ol/li, strong/em, a, code).
//
//   2. Service pages — content is structured JSON (intro,
//      sections[], features[], faqs[]). We compose the markdown
//      directly for maximum control over headings + ordering.
//
//   3. Top-level pages (home, about, services, contact, blog) —
//      minimal content (hero + CTA). Emit a short overview.

import TurndownService from 'turndown'
import { SITE } from './marketing-content'

// One converter instance, configured once. Turndown is tiny and
// deterministic, so a module-scoped singleton is safe.
const turndown = new TurndownService({
  headingStyle: 'atx',       // ## rather than underlines
  codeBlockStyle: 'fenced',  // ```lang rather than 4-space indent
  bulletListMarker: '-',
  emDelimiter: '_',
  strongDelimiter: '**',
  linkStyle: 'inlined',
})
// Strip empty paragraphs Turndown otherwise emits as `\n\n`
turndown.addRule('emptyParagraph', {
  filter: (node) => node.nodeName === 'P' && !node.textContent?.trim(),
  replacement: () => '',
})
// Never output `<script>`/`<style>` (paranoid — DOMPurify already strips)
turndown.remove(['script', 'style'])

// Convert a sanitised HTML string to markdown.
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return turndown.turndown(html).trim()
}

// ── Blog post ─────────────────────────────────────────────────────

export interface BlogPostMd {
  title: string
  slug: string
  excerpt?: string | null
  body?: string
  tags?: string[]
  authorName?: string | null
  publishedAt?: string | null
  keywords?: string[]
}

export function renderBlogPostMd(post: BlogPostMd): string {
  const lines: string[] = []
  lines.push(`# ${post.title}`, '')
  const meta: string[] = []
  if (post.authorName) meta.push(`**Author:** ${post.authorName}`)
  if (post.publishedAt) meta.push(`**Published:** ${post.publishedAt.slice(0, 10)}`)
  if (post.tags?.length) meta.push(`**Tags:** ${post.tags.join(', ')}`)
  if (meta.length) { lines.push(meta.join('  \n'), '') }
  if (post.excerpt) { lines.push(`> ${post.excerpt}`, '') }
  lines.push(`**Canonical URL:** ${SITE.url}/blog/${post.slug}`, '')
  lines.push('---', '')
  if (post.body) lines.push(htmlToMarkdown(post.body))
  return lines.join('\n')
}

// ── Service page ─────────────────────────────────────────────────

export interface ServicePageMd {
  title: string
  slug: string
  metaDescription?: string
  content: {
    heroBadge?: string
    heroTitle?: string
    heroHighlight?: string
    heroSubtitle?: string
    intro?: string
    sections?: { title: string; body: string }[]
    features?: { title: string; description: string }[]
    faqs?: { question: string; answer: string }[]
    ctaTitle?: string
    ctaSubtitle?: string
  }
}

export function renderServicePageMd(page: ServicePageMd): string {
  const c = page.content
  const lines: string[] = []
  // Hero title composed from heroTitle + heroHighlight (matches the
  // React render).
  const fullTitle = [c.heroTitle, c.heroHighlight].filter(Boolean).join(' ')
  lines.push(`# ${fullTitle || page.title}`, '')
  if (c.heroSubtitle) { lines.push(`> ${c.heroSubtitle}`, '') }
  lines.push(`**Canonical URL:** ${SITE.url}/services/${page.slug}`, '')
  if (c.heroBadge) lines.push(`**Category:** ${c.heroBadge}`, '')
  lines.push('')
  if (c.intro) { lines.push('## Overview', '', c.intro, '') }
  if (c.sections?.length) {
    for (const s of c.sections) {
      lines.push(`## ${s.title}`, '', htmlToMarkdown(s.body), '')
    }
  }
  if (c.features?.length) {
    lines.push('## Capabilities', '')
    for (const f of c.features) {
      lines.push(`- **${f.title}** — ${f.description}`)
    }
    lines.push('')
  }
  if (c.faqs?.length) {
    lines.push('## FAQ', '')
    for (const f of c.faqs) {
      lines.push(`### ${f.question}`, '', f.answer, '')
    }
  }
  if (c.ctaTitle || c.ctaSubtitle) {
    lines.push('---', '')
    if (c.ctaTitle) lines.push(`## ${c.ctaTitle}`, '')
    if (c.ctaSubtitle) lines.push(c.ctaSubtitle, '')
    lines.push(`[Book a demo](${SITE.url}/contact)`, '')
  }
  return lines.join('\n')
}

// ── Top-level page (home/about/services/contact/blog) ────────────

export interface TopPageMd {
  slug: string
  title: string
  metaDescription?: string
  content: {
    heroBadge?: string
    heroTitle?: string
    heroHighlight?: string
    heroSubtitle?: string
    ctaTitle?: string
    ctaSubtitle?: string
    introTitle?: string
    introSubtitle?: string
  }
}

export function renderTopPageMd(page: TopPageMd): string {
  const c = page.content
  const lines: string[] = []
  const fullTitle = [c.heroTitle, c.heroHighlight].filter(Boolean).join(' ')
  lines.push(`# ${fullTitle || page.title}`, '')
  if (c.heroSubtitle) { lines.push(`> ${c.heroSubtitle}`, '') }
  lines.push(`**Canonical URL:** ${page.slug === 'home' ? SITE.url : `${SITE.url}/${page.slug}`}`, '')
  if (page.metaDescription) lines.push(page.metaDescription, '')
  if (c.introTitle) lines.push(`## ${c.introTitle}`, '')
  if (c.introSubtitle) lines.push(c.introSubtitle, '')
  if (c.ctaTitle) lines.push('', '## ' + c.ctaTitle, '')
  if (c.ctaSubtitle) lines.push(c.ctaSubtitle, '')
  return lines.join('\n')
}
