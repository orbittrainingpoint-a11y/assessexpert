import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { Icon } from '@/components/marketing/icons'
import { getPageMeta } from '@/lib/cms'
import { SITE, PAGE_CONTENT } from '@/lib/marketing-content'
import { MANPOWER_ROLES } from '@/lib/manpower-roles'

// Index page for the manpower service line. Companion to the assessment
// /services page. Lists every role we place, grouped by category. Each
// card links to the dedicated /manpower/<role> landing.

export async function generateMetadata(): Promise<Metadata> {
  const m = await getPageMeta('manpower')
  const url = `${SITE.url}/manpower`
  return {
    title: m.metaTitle,
    description: m.metaDescription,
    keywords: m.keywords,
    alternates: { canonical: url },
    openGraph: { title: m.metaTitle, description: m.metaDescription, url, siteName: SITE.name, type: 'website' },
    twitter: { card: 'summary_large_image', title: m.metaTitle, description: m.metaDescription },
  }
}

const CENTERED_ORB_STYLE = { '--ox': '-50%' } as CSSProperties

const HOW_IT_WORKS = [
  { num: 1, title: 'Send us the role brief', desc: 'Job description, seniority band, tooling, delivery model (contract / permanent / project), and the target start date. A 15-minute call is usually enough.' },
  { num: 2, title: 'We shortlist from the pre-assessed pool', desc: 'Profiles from our vetted pool are matched first. Where nothing fits, we run a fresh sourcing + proctored assessment cycle within 5 business days.' },
  { num: 3, title: 'You receive CV + assessment score', desc: 'Each shortlist arrives with the CV, the AssessExpert proctored assessment result, integrity signal, and a short suitability note from our team.' },
  { num: 4, title: 'Interview and close', desc: 'You interview only the shortlisted candidates — every one has demonstrable ability on the tools you asked for. Contract or offer letter is drafted post-decision.' },
]

const ENGAGEMENT_MODELS = [
  { title: 'Contract Staffing', accent: '#3B82F6', icon: 'shield' as const,
    desc: 'Monthly rate covering sponsorship, payroll, medical, and gratuity. Deployments from 3 to 36 months. Switch to permanent at any time.',
    fits: '3–36 month projects, seasonal peaks, and clients that want to trial the person before permanent commitment.' },
  { title: 'Permanent Placement', accent: '#059669', icon: 'check' as const,
    desc: 'Direct-hire to your entity. Success-based fee as a percentage of first-year package. One free replacement if the candidate does not clear probation for performance reasons.',
    fits: 'Building core team headcount; strategic hires you want on your own visa and books.' },
  { title: 'Project Outsourcing', accent: '#22D3EE' as const, icon: 'building' as const,
    desc: 'A small delivery team under our supervision, priced on deliverables. We hold the risk on team composition, replacement, and quality.',
    fits: 'Bounded scope of work — a DD/CD package, a BIM model, a survey campaign — where you want the outcome not the headcount.' },
]

export default async function ManpowerIndexPage() {
  const content = PAGE_CONTENT.manpower
  const url = `${SITE.url}/manpower`

  // Group roles by category for the grid.
  const grouped = MANPOWER_ROLES.reduce<Record<string, typeof MANPOWER_ROLES[number][]>>((acc, role) => {
    (acc[role.category] ??= []).push(role)
    return acc
  }, {})

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Skilled Manpower Supply',
    provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    areaServed: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman'],
    serviceType: 'Engineering, design, and construction talent placement',
    description: content.heroSubtitle,
    url,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <SiteNav />

      {/* HERO */}
      <header style={{ position: 'relative', padding: '120px 24px 90px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(5,150,105,0.16)', top: '-160px', left: '50%', transform: 'translateX(-50%)', ...CENTERED_ORB_STYLE }} />
        <Reveal style={{ position: 'relative', maxWidth: '820px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '20px' }}>{content.heroBadge}</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,58px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.05, fontFamily: 'var(--web-serif)' }}>
            {content.heroTitle} <span className="web-gradient-text">{content.heroHighlight}</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--web-text-secondary)', lineHeight: 1.75, margin: '0 auto', maxWidth: '640px' }}>
            {content.heroSubtitle}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '32px', flexWrap: 'wrap' }}>
            <Link href="/contact" className="btn-web-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              Share a role brief <ArrowRight size={14} />
            </Link>
            <Link href="/services" className="btn-web-ghost">Assessment platform</Link>
          </div>
        </Reveal>
      </header>

      {/* ROLES GRID — grouped by category */}
      <section style={{ padding: '90px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ marginBottom: '48px', textAlign: 'center' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Role Catalogue</div>
          <h2 style={{ fontSize: 'clamp(30px,5vw,42px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
            12 role tracks, one hiring standard
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--web-text-secondary)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
            Every candidate — from junior draftsman to programme director — clears the same proctored assessment before their CV reaches you.
          </p>
        </Reveal>

        {(['Engineering', 'Design', 'Construction Management'] as const).map((cat, ci) => (
          <div key={cat} style={{ marginBottom: '48px' }}>
            <Reveal style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--web-text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {cat}
              </h3>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              {(grouped[cat] || []).map((role, i) => {
                const accent = cat === 'Engineering' ? '#3B82F6' : cat === 'Design' ? '#22D3EE' : '#059669'
                return (
                  <Reveal key={role.slug} delay={((ci * 4) + i) * 30}>
                    <Link href={`/manpower/${role.slug}`} className="web-card web-tilt" style={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit', padding: '24px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                      <h4 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: 'var(--web-text)', letterSpacing: '-0.01em' }}>{role.title}</h4>
                      <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--web-text-secondary)', lineHeight: 1.65 }}>{role.shortTagline}</p>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: accent, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        Hire {role.title.toLowerCase()}s <ArrowRight size={12} />
                      </span>
                    </Link>
                  </Reveal>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>How It Works</div>
            <h2 style={{ fontSize: 'clamp(30px,5vw,42px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
              From brief to onboarded — inside a week
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.num} delay={i * 60}>
                <article className="web-card" style={{ padding: '24px', height: '100%' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#059669', letterSpacing: '0.12em', marginBottom: '10px' }}>STEP {String(step.num).padStart(2, '0')}</div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700, color: 'var(--web-text)' }}>{step.title}</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-secondary)', lineHeight: 1.7 }}>{step.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ENGAGEMENT MODELS */}
      <section style={{ padding: '100px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Engagement Models</div>
          <h2 style={{ fontSize: 'clamp(30px,5vw,42px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
            Contract, permanent, or a delivered outcome
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {ENGAGEMENT_MODELS.map((m, i) => (
            <Reveal key={m.title} delay={i * 60}>
              <article className="web-card" style={{ padding: '28px', height: '100%', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${m.accent}, transparent)` }} />
                <div className="web-icon-tile" style={{ width: 44, height: 44, background: `${m.accent}18`, border: `1px solid ${m.accent}30`, marginBottom: 16 }}>
                  <Icon name={m.icon} size={20} color={m.accent} />
                </div>
                <h4 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: 'var(--web-text)' }}>{m.title}</h4>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--web-text-secondary)', lineHeight: 1.7 }}>{m.desc}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)', fontStyle: 'italic' }}><strong style={{ color: 'var(--web-text-secondary)' }}>Best for:</strong> {m.fits}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '110px 24px', textAlign: 'center', background: 'linear-gradient(180deg, transparent, rgba(5,150,105,0.06))' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>
            {content.ctaTitle}
          </h2>
          <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', lineHeight: 1.75, margin: '0 0 28px' }}>
            {content.ctaSubtitle}
          </p>
          <Link href="/contact" className="btn-web-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px' }}>
            Share your role brief <ArrowRight size={14} />
          </Link>
        </Reveal>
      </section>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
