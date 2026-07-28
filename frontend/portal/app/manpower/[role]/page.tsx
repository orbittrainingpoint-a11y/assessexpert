import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ChevronRight } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { getManpowerPage } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'
import { MANPOWER_ROLE_SLUGS, MANPOWER_ROLES } from '@/lib/manpower-roles'
import { breadcrumbSchema, faqPageSchema, jsonLdProps, ORG_ID } from '@/lib/seo-schema'

// Twin of app/services/[slug]/page.tsx for the manpower service line.
// Same content shape (ServicePageContent), same renderer, different
// route + breadcrumb + Service.serviceType.

export const revalidate = 60

export function generateStaticParams() {
  return MANPOWER_ROLE_SLUGS.map((role) => ({ role }))
}

type Props = { params: Promise<{ role: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params
  const page = await getManpowerPage(role)
  if (!page) return { title: 'Manpower role not found | AssessExpert' }
  const url = `${SITE.url}/manpower/${role}`
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: { canonical: url },
    openGraph: { title: page.metaTitle, description: page.metaDescription, url, siteName: SITE.name, type: 'website' },
    twitter: { card: 'summary_large_image', title: page.metaTitle, description: page.metaDescription },
  }
}

const CENTERED_ORB_STYLE = { '--ox': '-50%' } as CSSProperties

export default async function ManpowerRolePage({ params }: Props) {
  const { role } = await params
  const page = await getManpowerPage(role)
  if (!page) notFound()

  // Look up the catalogue entry so the breadcrumb reads with the
  // human role title even before the DB roundtrip resolves.
  const meta = MANPOWER_ROLES.find((r) => r.slug === role)
  const { content } = page
  const url = `${SITE.url}/manpower/${role}`

  const graph: object[] = []
  graph.push({
    '@type': 'Service',
    '@id': `${url}#service`,
    name: `${meta?.title || page.title} — Manpower Supply`,
    description: page.metaDescription,
    url,
    provider: { '@id': ORG_ID },
    serviceType: 'Skilled Manpower Supply',
    areaServed: [
      { '@type': 'Country', name: 'United Arab Emirates' },
      { '@type': 'Country', name: 'Saudi Arabia' },
      { '@type': 'Country', name: 'Qatar' },
      { '@type': 'Country', name: 'Kuwait' },
      { '@type': 'Country', name: 'Bahrain' },
      { '@type': 'Country', name: 'Oman' },
    ],
    audience: { '@type': 'BusinessAudience', audienceType: 'engineering consultancies, contractors, developers, HR teams' },
  })
  if (content.faqs.length) graph.push(faqPageSchema(content.faqs))
  graph.push(breadcrumbSchema([
    { name: 'Home', url: SITE.url },
    { name: 'Manpower', url: `${SITE.url}/manpower` },
    { name: meta?.title || page.title, url },
  ]))
  const pageJsonLd = { '@context': 'https://schema.org', '@graph': graph }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <script {...jsonLdProps(pageJsonLd)} />
      <SiteNav />

      {/* HERO */}
      <header style={{ position: 'relative', padding: '120px 24px 80px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(5,150,105,0.16)', top: '-150px', left: '50%', transform: 'translateX(-50%)', ...CENTERED_ORB_STYLE }} />
        <Reveal style={{ position: 'relative', maxWidth: '820px', margin: '0 auto' }}>
          <nav style={{ marginBottom: '20px', fontSize: '13px', color: 'var(--web-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Link href="/manpower" style={{ color: 'var(--web-text-muted)', textDecoration: 'none' }}>Manpower</Link>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--web-gold)' }}>{meta?.title || page.title}</span>
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

      {/* INTRO — direct answer paragraph for AEO */}
      <section style={{ padding: '40px 24px 60px', maxWidth: '760px', margin: '0 auto' }}>
        <Reveal>
          <div className="web-card" style={{ padding: '32px', borderLeft: '3px solid #059669' }}>
            <p style={{ margin: 0, fontSize: '17px', color: 'var(--web-text-secondary)', lineHeight: 1.8 }}>
              {content.intro}
            </p>
          </div>
        </Reveal>
      </section>

      {/* SECTIONS */}
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
                How the placement works
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
      <section style={{ padding: '100px 24px', textAlign: 'center', background: 'rgba(5,150,105,0.05)', borderTop: '1px solid rgba(5,150,105,0.16)' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
            {content.ctaTitle}
          </h2>
          <p style={{ color: 'var(--web-text-secondary)', fontSize: '16px', marginBottom: '36px', lineHeight: 1.7 }}>
            {content.ctaSubtitle}
          </p>
          <Link href="/contact" className="web-btn-primary" style={{ padding: '14px 40px', fontSize: '16px', gap: 8 }}>
            Share your role brief <ArrowRight size={18} />
          </Link>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
