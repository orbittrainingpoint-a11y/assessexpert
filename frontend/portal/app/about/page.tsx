import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, X } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { Icon } from '@/components/marketing/icons'
import { CountUp } from '@/components/marketing/CountUp'
import { getMarketingPageContent, getPageMeta } from '@/lib/cms'
import { SITE, type IconKey } from '@/lib/marketing-content'

export async function generateMetadata(): Promise<Metadata> {
  const m = await getPageMeta('about')
  return {
    title: m.metaTitle, description: m.metaDescription, keywords: m.keywords,
    alternates: { canonical: `${SITE.url}/about` },
    openGraph: { title: m.metaTitle, description: m.metaDescription, url: `${SITE.url}/about`, siteName: SITE.name, type: 'website' },
  }
}

const VALUES: { icon: IconKey; title: string; desc: string; accent: string }[] = [
  { icon: 'target', title: 'Precision over Speed', desc: 'Every report is reviewed by a certified proctor before it reaches HR. We never sacrifice accuracy for turnaround time.', accent: '#3B8DFF' },
  { icon: 'lock', title: 'Integrity First', desc: 'AI proctoring, facial recognition, and screen recording work together to ensure every result reflects genuine candidate ability.', accent: '#38BDF8' },
  { icon: 'handshake', title: 'B2B Partnership', desc: 'We work directly with companies — no public marketplace, no self-signup. Every client relationship starts with a conversation.', accent: '#059669' },
  { icon: 'globe', title: 'Built for the Region', desc: 'Headquartered in Dubai, built for the GCC and global markets. Full Arabic and English support across all portals.', accent: '#60A5FA' },
]

const APPROACH = [
  { title: 'Managed Service, Not Self-Service', desc: 'You don\'t configure assessments — we do. Our Exam Setup team builds question banks, practical tasks, and scoring rubrics tailored to your job roles. You focus on hiring; we handle the assessment infrastructure.' },
  { title: 'Human-in-the-Loop, Always', desc: 'AI generates reports, flags anomalies, and tracks integrity. But a human proctor reviews every flag and signs off on every report. Technology assists; people decide.' },
  { title: 'Evidence-Based Hiring Decisions', desc: 'Our reports don\'t give you a "pass/fail" checkbox. They show every question, every answer, practical task quality, integrity score, and a narrative assessment. HR gets the full picture.' },
]

const MILESTONES = [
  { year: '2024', event: 'assessexpert concept developed by Orbit Training, Dubai' },
  { year: '2025', event: 'Platform architecture designed — proctor-first, AI-assisted model' },
  { year: '2026', event: 'Full platform launch — 67 assessment types across 12 industry groups' },
  { year: '2026+', event: 'Global expansion — GCC, MENA, and international markets' },
]

const IS = [
  'A universal pre-employment assessment platform — any industry, any job type',
  'An on-demand managed service — HR uploads a list, the system does the rest',
  'A proctor-first platform — human proctor drives the exam lifecycle',
  'A two-phase exam engine — MCQ theory always followed by a practical task',
  'A 500-question shuffled exam system — no two candidates see the same set',
  'A multi-tenant B2B portal — each company sees only their own data',
]
const IS_NOT = [
  'A self-service quiz or form builder',
  'A public assessment marketplace or job board',
  'A platform with a payment page or checkout',
  'A system where candidates can see their own reports',
  'A platform where reports auto-publish without proctor review',
  'An LMS or learning platform',
]

const CENTERED_ORB_STYLE = { '--ox': '-50%' } as CSSProperties
const particleMotion = (duration: string, delay: string) => ({ '--dur': duration, '--delay': delay } as CSSProperties)

export default async function AboutPage() {
  const content = await getMarketingPageContent('about')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <SiteNav />

      {/* ════════════════════ HERO ════════════════════ */}
      <header style={{ position: 'relative', padding: '140px 24px 120px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-particle" style={{ width: '5px', height: '5px', top: '20%', left: '15%', ...particleMotion('18s', '0s') }} />
        <div className="web-particle" style={{ width: '4px', height: '4px', top: '30%', right: '12%', ...particleMotion('22s', '3s') }} />
        <div className="web-glow-orb animate" style={{ width: '600px', height: '600px', background: 'rgba(33,115,255,0.18)', top: '-200px', left: '50%', transform: 'translateX(-50%)', ...CENTERED_ORB_STYLE }} />
        <Reveal style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '24px' }}>{content.heroBadge}</div>
          <h1 style={{ fontSize: 'clamp(40px,6.5vw,64px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.05, fontFamily: 'var(--web-serif)' }}>
            {content.heroTitle} <span className="web-gradient-text">{content.heroHighlight}</span>
          </h1>
          <p style={{ fontSize: '19px', color: 'var(--web-text-secondary)', lineHeight: 1.75, margin: '0 auto', maxWidth: '660px' }}>
            {content.heroSubtitle}
          </p>
        </Reveal>
      </header>

      {/* ════════════════════ STATS BAR ════════════════════ */}
      <section style={{ borderTop: '1px solid rgba(59,141,255,0.14)', borderBottom: '1px solid rgba(59,141,255,0.14)', padding: '60px 24px', background: 'rgba(33,115,255,0.045)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '40px', textAlign: 'center' }}>
          <Reveal>
            <CountUp end={67} suffix="+" style={{ fontSize: '52px' }} />
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--web-text-secondary)' }}>Assessment Types</p>
          </Reveal>
          <Reveal delay={60}>
            <CountUp end={12} style={{ fontSize: '52px' }} />
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--web-text-secondary)' }}>Industry Groups</p>
          </Reveal>
          <Reveal delay={120}>
            <CountUp end={500} suffix="+" style={{ fontSize: '52px' }} />
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--web-text-secondary)' }}>Questions per Bank</p>
          </Reveal>
          <Reveal delay={180}>
            <CountUp end={100} suffix="%" style={{ fontSize: '52px' }} />
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--web-text-secondary)' }}>Proctor-Reviewed</p>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════ MISSION ════════════════════ */}
      <section style={{ padding: '100px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <Reveal>
          <div style={{ position: 'relative', padding: '64px 56px', background: 'rgba(33,115,255,0.05)', border: '1px solid rgba(59,141,255,0.18)', borderRadius: '24px', textAlign: 'center', overflow: 'hidden' }}>
            <div className="web-glow-orb" style={{ width: '300px', height: '300px', background: 'rgba(56,189,248,0.12)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.3, color: 'var(--web-gold)', fontFamily: 'var(--web-serif)', lineHeight: 1 }}>&ldquo;</div>
              <p style={{ fontSize: '24px', fontWeight: 600, color: 'var(--web-text)', lineHeight: 1.65, margin: '0 auto 28px', maxWidth: '720px', fontFamily: 'var(--web-serif)' }}>
                We believe hiring decisions should be based on verified, structured evidence — not gut feel. assessexpert gives HR teams the truth about every candidate.
              </p>
              <div className="web-divider" style={{ margin: '0 auto 20px' }} />
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--web-text-muted)', fontWeight: 500 }}>— assessexpert · {SITE.org} · Dubai, UAE</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ════════════════════ OUR APPROACH ════════════════════ */}
      <section style={{ padding: '0 24px 120px', maxWidth: '1100px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>How We Work</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Our Approach</h2>
          <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.7 }}>
            Three principles that define how we deliver every assessment.
          </p>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {APPROACH.map((item, i) => (
            <Reveal key={item.title} delay={i * 60}>
              <div className="web-card-glow">
                <div className="web-card-glow-inner" style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--web-gold-dim)', border: '1px solid rgba(59,141,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: 'var(--web-gold)', fontFamily: 'var(--web-serif)', flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: 'var(--web-text)', fontFamily: 'var(--web-serif)' }}>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: '15px', color: 'var(--web-text-secondary)', lineHeight: 1.75 }}>{item.desc}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════════ IS / IS NOT ════════════════════ */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '120px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Clarity</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>What assessexpert Is &amp; Is Not</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            <Reveal>
              <div style={{ padding: '44px', background: 'rgba(5,150,105,0.04)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '16px', height: '100%' }}>
                <h3 style={{ margin: '0 0 28px', fontSize: '18px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Check size={20} /> What assessexpert IS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {IS.map((item) => (
                    <div key={item} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <ArrowRight size={15} color="#059669" style={{ marginTop: 3, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.6 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <div style={{ padding: '44px', background: 'rgba(225,29,72,0.04)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '16px', height: '100%' }}>
                <h3 style={{ margin: '0 0 28px', fontSize: '18px', fontWeight: 700, color: '#E11D48', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <X size={20} /> What assessexpert IS NOT
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {IS_NOT.map((item) => (
                    <div key={item} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <X size={15} color="#E11D48" style={{ marginTop: 3, flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.6 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ════════════════════ VALUES ════════════════════ */}
      <section style={{ padding: '120px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>What Drives Us</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Our Values</h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={(i % 2) * 60}>
              <div className="web-card web-tilt" style={{ display: 'flex', gap: '20px', position: 'relative', overflow: 'hidden', height: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px', background: v.accent }} />
                <div className="web-icon-tile web-pulse" style={{ width: 52, height: 52, background: `${v.accent}15`, border: `1px solid ${v.accent}25`, flexShrink: 0, marginLeft: 8 }}>
                  <Icon name={v.icon} size={24} color={v.accent} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700, color: 'var(--web-text)' }}>{v.title}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.75 }}>{v.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════════ TIMELINE ════════════════════ */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '120px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Our Journey</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Milestones</h2>
          </Reveal>
          <div style={{ position: 'relative', paddingLeft: '40px' }}>
            <div style={{ position: 'absolute', left: '15px', top: 0, bottom: 0, width: '2px', background: 'linear-gradient(180deg, var(--web-gold), rgba(59,141,255,0.08))' }} />
            {MILESTONES.map((m, i) => (
              <Reveal key={m.year} delay={i * 60} style={{ position: 'relative', marginBottom: i < MILESTONES.length - 1 ? '48px' : 0 }}>
                <div style={{ position: 'absolute', left: '-33px', top: '4px', width: '16px', height: '16px', background: 'var(--web-gold)', borderRadius: '50%', border: '3px solid var(--web-bg)', boxShadow: '0 0 16px rgba(59,141,255,0.48)' }} />
                <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--web-gold)', minWidth: '52px', paddingTop: '2px', fontFamily: 'var(--web-serif)' }}>{m.year}</span>
                  <p style={{ margin: 0, fontSize: '16px', color: 'var(--web-text-secondary)', lineHeight: 1.65 }}>{m.event}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ CTA ════════════════════ */}
      <section style={{ padding: '140px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(33,115,255,0.14)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', ...CENTERED_ORB_STYLE }} />
        <div className="web-particle" style={{ width: '4px', height: '4px', top: '25%', left: '25%', ...particleMotion('20s', '0s') }} />
        <Reveal style={{ position: 'relative', maxWidth: '620px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 20px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>{content.ctaTitle}</h2>
          <p style={{ color: 'var(--web-text-secondary)', fontSize: '17px', marginBottom: '44px', lineHeight: 1.7 }}>{content.ctaSubtitle}</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contact" className="web-btn-primary" style={{ padding: '16px 44px', fontSize: '16px', gap: 10 }}>Get in Touch <ArrowRight size={18} /></Link>
            <Link href="/services" className="web-btn-outline" style={{ padding: '16px 44px', fontSize: '16px' }}>Explore Services</Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
