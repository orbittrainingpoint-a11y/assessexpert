import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ChevronRight } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { getServicePage } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'
import { SERVICE_PAGE_SLUGS } from '@/lib/service-slugs'

// Revalidate cached service pages every 60s so editor changes appear
// within a minute without a redeploy.
export const revalidate = 60

// Pre-render every service page slug at build so the SEO landing
// pages ship as static HTML on first request.
export function generateStaticParams() {
  return SERVICE_PAGE_SLUGS.map((slug) => ({ slug }))
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getServicePage(slug)
  if (!page) return { title: 'Service not found | AssessExpert' }
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: { canonical: `${SITE.url}/services/${page.slug}` },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: `${SITE.url}/services/${page.slug}`,
      siteName: SITE.name,
      type: 'website',
    },
  }
}

const CENTERED_ORB_STYLE = { '--ox': '-50%' } as CSSProperties

export default async function ServicePage({ params }: Props) {
  const { slug } = await params
  const page = await getServicePage(slug)
  if (!page) notFound()

  const { content } = page

  // FAQ schema for AEO/AI search. We render this even if the page is
  // updated through the CMS — it's read from the content shape, not
  // hard-coded.
  const faqJsonLd = content.faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: content.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}
      <SiteNav />

      {/* HERO */}
      <header style={{ position: 'relative', padding: '120px 24px 80px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(33,115,255,0.18)', top: '-150px', left: '50%', transform: 'translateX(-50%)', ...CENTERED_ORB_STYLE }} />
        <Reveal style={{ position: 'relative', maxWidth: '820px', margin: '0 auto' }}>
          <nav style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--web-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Link href="/services" style={{ color: 'var(--web-text-muted)', textDecoration: 'none' }}>Services</Link>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--web-gold)' }}>{page.title}</span>
          </nav>
          <div className="web-label" style={{ marginBottom: '20px' }}>{content.heroBadge}</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,60px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.05, fontFamily: 'var(--web-serif)' }}>
            {content.heroTitle} <span className="web-gradient-text">{content.heroHighlight}</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--web-text-secondary)', lineHeight: 1.75, margin: '0 auto', maxWidth: '680px' }}>
            {content.heroSubtitle}
          </p>
        </Reveal>
      </header>

      {/* INTRO — Direct answer paragraph for AEO. Lead with the
          definition so AI search engines and featured snippets pick it
          up cleanly. */}
      <section style={{ padding: '40px 24px 60px', maxWidth: '760px', margin: '0 auto' }}>
        <Reveal>
          <div className="web-card" style={{ padding: '32px', borderLeft: '3px solid var(--web-gold)' }}>
            <p style={{ margin: 0, fontSize: '17px', color: 'var(--web-text-secondary)', lineHeight: 1.8 }}>
              {content.intro}
            </p>
          </div>
        </Reveal>
      </section>

      {/* SECTIONS — main editorial body */}
      {content.sections.length > 0 && (
        <section style={{ padding: '40px 24px 80px', maxWidth: '820px', margin: '0 auto' }}>
          {content.sections.map((s, i) => {
            const safeBody = DOMPurify.sanitize(s.body, { USE_PROFILES: { html: true } })
            return (
              <Reveal key={s.title + i} style={{ marginBottom: '48px' }}>
                <h2 style={{ fontSize: 'clamp(24px,3.5vw,32px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
                  {s.title}
                </h2>
                <div className="web-prose" dangerouslySetInnerHTML={{ __html: safeBody }} />
              </Reveal>
            )
          })}
        </section>
      )}

      {/* FEATURES */}
      {content.features.length > 0 && (
        <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '100px 24px' }}>
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
            <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
              <div className="web-label" style={{ marginBottom: '16px' }}>What you get</div>
              <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
                Capabilities
              </h2>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {content.features.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 60}>
                  <article className="web-card" style={{ height: '100%' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: 'var(--web-text)', letterSpacing: '-0.01em' }}>
                      {f.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.7 }}>
                      {f.description}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {content.faqs.length > 0 && (
        <section style={{ padding: '100px 24px', maxWidth: '820px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
              Common questions
            </h2>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {content.faqs.map((f, i) => (
              <Reveal key={f.question} delay={(i % 2) * 50}>
                <details className="web-card" style={{ padding: '20px 24px', cursor: 'pointer' }}>
                  <summary style={{ fontSize: '16px', fontWeight: 600, color: 'var(--web-text)', listStyle: 'none', cursor: 'pointer' }}>
                    {f.question}
                  </summary>
                  <p style={{ margin: '14px 0 0', fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.7 }}>
                    {f.answer}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: 'rgba(33,115,255,0.035)', borderTop: '1px solid rgba(59,141,255,0.16)' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
            {content.ctaTitle}
          </h2>
          <p style={{ color: 'var(--web-text-secondary)', fontSize: '16px', marginBottom: '36px', lineHeight: 1.7 }}>
            {content.ctaSubtitle}
          </p>
          <Link href="/contact" className="web-btn-primary" style={{ padding: '14px 40px', fontSize: '16px', gap: 8 }}>
            Book a Demo <ArrowRight size={18} />
          </Link>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
