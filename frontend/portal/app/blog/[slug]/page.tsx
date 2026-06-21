import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { getPost, extractFaqsFromBody } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'
import { breadcrumbSchema, faqPageSchema, jsonLdProps, ORG_ID } from '@/lib/seo-schema'

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Article not found | AssessExpert' }
  const title = post.metaTitle || `${post.title} | AssessExpert`
  const description = post.metaDescription || post.excerpt || undefined
  // OG/Twitter image must be absolute. Cover paths are seeded as
  // /blog-cover/<slug>.svg — promote to absolute here.
  const coverAbs = post.coverImage
    ? (post.coverImage.startsWith('http') ? post.coverImage : `${SITE.url}${post.coverImage}`)
    : undefined
  return {
    title, description, keywords: post.keywords,
    alternates: { canonical: `${SITE.url}/blog/${post.slug}` },
    openGraph: {
      title, description, url: `${SITE.url}/blog/${post.slug}`, siteName: SITE.name,
      type: 'article', publishedTime: post.publishedAt || undefined,
      images: coverAbs ? [{ url: coverAbs, width: 1200, height: 630, alt: post.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image', title, description: description || '',
      images: coverAbs ? [coverAbs] : undefined,
    },
  }
}

function fmtDate(d?: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const safeHtml = DOMPurify.sanitize(post.body || '', { USE_PROFILES: { html: true } })

  const url = `${SITE.url}/blog/${post.slug}`
  // Absolute URL for the cover image so OG/Twitter cards resolve it
  // correctly when shared from third-party sites.
  const coverAbs = post.coverImage
    ? (post.coverImage.startsWith('http') ? post.coverImage : `${SITE.url}${post.coverImage}`)
    : undefined

  // Bundle BlogPosting + FAQPage + BreadcrumbList into one @graph so
  // the rendered HTML only carries one schema script for the page.
  const graph: object[] = []
  graph.push({
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    headline: post.title,
    description: post.excerpt || post.metaDescription || undefined,
    image: coverAbs ? [coverAbs] : undefined,
    datePublished: post.publishedAt || undefined,
    dateModified: post.publishedAt || undefined,
    author: { '@type': 'Organization', name: post.authorName || SITE.name, url: SITE.url },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: url,
    keywords: post.keywords?.join(', ') || post.tags?.join(', '),
    articleSection: post.tags?.[0],
  })
  // FAQPage extracted from the body's `<h2>FAQ</h2>` block — editors
  // writing in /cms with the standard pattern get this for free.
  const faqItems = extractFaqsFromBody(post.body || '')
  if (faqItems.length) graph.push(faqPageSchema(faqItems))
  graph.push(breadcrumbSchema([
    { name: 'Home', url: SITE.url },
    { name: 'Blog', url: `${SITE.url}/blog` },
    { name: post.title, url },
  ]))
  const pageJsonLd = { '@context': 'https://schema.org', '@graph': graph }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <script {...jsonLdProps(pageJsonLd)} />
      <SiteNav />

      <article style={{ maxWidth: '760px', margin: '0 auto', padding: '80px 24px 100px' }}>
        <Link href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--web-gold)', textDecoration: 'none', fontSize: 14, fontWeight: 600, marginBottom: 28 }}>
          <ArrowLeft size={16} /> All articles
        </Link>

        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {post.tags.map((t) => (
              <span key={t} className="web-chip" style={{ background: 'var(--web-gold-dim)', border: '1px solid rgba(59,141,255,0.28)', color: 'var(--web-gold)' }}>{t}</span>
            ))}
          </div>
        )}

        <h1 style={{ fontSize: 'clamp(30px,5vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>{post.title}</h1>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: 'var(--web-text-muted)' }}>
          {post.authorName ? `${post.authorName} · ` : ''}{fmtDate(post.publishedAt)}
        </p>

        {post.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImage} alt={post.title} style={{ width: '100%', borderRadius: 16, border: '1px solid var(--web-border)', marginBottom: 40 }} />
        )}

        <div className="web-prose" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </article>

      <SiteFooter />
    </div>
  )
}
