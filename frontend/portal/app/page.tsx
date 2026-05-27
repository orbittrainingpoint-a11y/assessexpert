import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { Icon } from '@/components/marketing/icons'
import { CountUp } from '@/components/marketing/CountUp'
import { WorkflowTimeline } from '@/components/marketing/WorkflowTimeline'
import { Accordion } from '@/components/marketing/Accordion'
import { MarqueeStrip } from '@/components/marketing/MarqueeStrip'
import { getHomeContent, getPageMeta } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'

export async function generateMetadata(): Promise<Metadata> {
  const m = await getPageMeta('home')
  return {
    title: m.metaTitle,
    description: m.metaDescription,
    keywords: m.keywords,
    alternates: { canonical: SITE.url },
    openGraph: {
      title: m.metaTitle, description: m.metaDescription, url: SITE.url,
      siteName: SITE.name, type: 'website',
      images: m.ogImage ? [{ url: m.ogImage }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: m.metaTitle, description: m.metaDescription },
  }
}

const WORKFLOW_STEPS = [
  { num: 1, title: 'HR Schedules Assessment', desc: 'Upload your candidate list, choose the assessment type, and the platform sends magic-link invitations automatically. No candidate accounts needed.', icon: '\u{1F4CB}' },
  { num: 2, title: 'Proctor Runs Pre-Exam Checklist', desc: 'A certified proctor verifies Government ID, checks webcam and mic, records consent, and opens the session. Nothing starts without this step.', icon: '\u{1F50D}' },
  { num: 3, title: 'MCQ Theory Assessment', desc: '25 questions drawn from a 500-question bank via Fisher-Yates shuffle. One question at a time, server-side delivery. 30 minutes on the clock.', icon: '\u{1F9E0}' },
  { num: 4, title: 'Practical Task', desc: 'Role-specific hands-on task — CAD drawings, coding challenges, lab simulations, or file submissions. 60 minutes, proctor-monitored throughout.', icon: '\u{1F6E0}\u{FE0F}' },
  { num: 5, title: 'AI Generates Full Report', desc: 'AI drafts a detailed report: MCQ score breakdown, question-by-question review, practical evaluation, integrity score, and hiring recommendation.', icon: '\u{1F4CA}' },
  { num: 6, title: 'Proctor Reviews & Publishes', desc: 'The proctor reviews the AI draft, adds professional narrative, and publishes. Reports never auto-publish. HR receives the verified final report.', icon: '\u2705' },
]

const FAQ_ITEMS = [
  { q: 'How does the 500-question shuffle work?', a: 'Each assessment type maintains a bank of 500 questions. When a candidate starts, the Fisher-Yates algorithm selects 25 questions at random. Questions are delivered one at a time from the server — the full set is never sent to the browser. No two candidates receive the same paper.' },
  { q: 'Can candidates cheat during the exam?', a: 'Multiple layers prevent this: real-time AI face detection verifies the registered face throughout, gaze tracking flags off-screen looks, tab-switch monitoring catches browser changes, and the full session is screen + webcam recorded. A human proctor reviews every AI flag before it affects the report.' },
  { q: 'Do reports auto-publish to HR?', a: 'Never. Every report must be manually reviewed and published by a certified proctor. This is a hard platform rule — there is no toggle to enable auto-publish. This ensures HR only sees verified, quality-controlled results.' },
  { q: 'What industries and job roles are supported?', a: 'Any industry, any job role. We currently cover 67+ assessment types across Engineering, IT, Finance, HR, Operations, Design, Data Analytics, and Administration. Our Exam Setup team builds custom assessments on request — question bank, practical task, and scoring rubric.' },
  { q: 'How is candidate data protected?', a: 'Strict multi-tenant isolation: each company sees only their own data, enforced at database level. Session recordings are retained for 7 days and then automatically purged. All data is encrypted in transit and at rest. No cross-company data leakage, ever.' },
  { q: 'How long does onboarding take?', a: 'After the commercial agreement, your company portal is set up within 1 business day. A dedicated onboarding call walks your HR team through the platform. Your first assessment session can run the same week.' },
  { q: 'Is there a self-signup or free trial?', a: 'No. assessexpert is a sales-led, managed-service platform. Every client relationship starts with a conversation. This ensures we understand your hiring needs and configure the right assessment types before you go live.' },
]

const SECURITY_FEATURES = [
  { title: 'AI Face Detection', desc: 'Continuous identity verification throughout the exam. The registered face is matched in real-time — any mismatch is flagged instantly.', icon: 'eye' as const },
  { title: 'Gaze Tracking', desc: 'Detects off-screen looks and suspicious eye movements. AI flags these events for proctor review.', icon: 'target' as const },
  { title: 'Tab-Switch Monitoring', desc: 'Every browser tab change is logged and timestamped. Candidates are warned; repeated switches are escalated.', icon: 'layers' as const },
  { title: 'Full Session Recording', desc: 'Screen + webcam captured for the entire session. Available to HR for 7 days, then auto-purged.', icon: 'shield' as const },
]

const MARQUEE_ITEMS = [
  'Engineering', 'Information Technology', 'Finance', 'Human Resources',
  'Operations', 'Design & Creative', 'Data Analytics', 'Construction',
  'Administration', 'Cybersecurity', 'Project Management', 'Any Custom Role',
]

const CENTERED_ORB_STYLE = { '--ox': '-50%' } as CSSProperties
const particleMotion = (duration: string, delay: string) => ({ '--dur': duration, '--delay': delay } as CSSProperties)

export default async function HomePage() {
  const c = await getHomeContent()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: SITE.name,
        url: SITE.url,
        description: SITE.tagline,
        email: SITE.email,
        address: { '@type': 'PostalAddress', addressLocality: 'Dubai', addressCountry: 'AE' },
      },
      { '@type': 'WebSite', name: SITE.name, url: SITE.url },
      {
        '@type': 'SoftwareApplication',
        name: SITE.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Contact sales for pricing' },
      },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />

      {/* ════════════════════ HERO ════════════════════ */}
      <header style={{ position: 'relative', padding: '160px 24px 140px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        {/* Floating particles */}
        <div className="web-particle" style={{ width: '6px', height: '6px', top: '15%', left: '12%', ...particleMotion('18s', '0s') }} />
        <div className="web-particle" style={{ width: '4px', height: '4px', top: '25%', right: '15%', ...particleMotion('22s', '3s') }} />
        <div className="web-particle" style={{ width: '5px', height: '5px', top: '60%', left: '8%', ...particleMotion('16s', '6s') }} />
        <div className="web-particle" style={{ width: '3px', height: '3px', top: '40%', right: '10%', ...particleMotion('20s', '2s') }} />
        <div className="web-particle" style={{ width: '4px', height: '4px', top: '70%', left: '20%', ...particleMotion('25s', '5s') }} />

        {/* Glow orbs */}
        <div className="web-glow-orb animate" style={{ width: '700px', height: '700px', background: 'rgba(33,115,255,0.18)', top: '-250px', left: '50%', transform: 'translateX(-50%)', ...CENTERED_ORB_STYLE }} />
        <div className="web-glow-orb animate" style={{ width: '350px', height: '350px', background: 'rgba(56,189,248,0.1)', top: '100px', left: '5%' }} />
        <div className="web-glow-orb animate" style={{ width: '350px', height: '350px', background: 'rgba(37,99,235,0.1)', top: '120px', right: '5%' }} />

        <div style={{ position: 'relative', maxWidth: '960px', margin: '0 auto' }}>
          <Reveal><div className="web-label" style={{ marginBottom: '32px' }}>{c.heroBadge}</div></Reveal>
          <Reveal delay={60} as="h1" style={{ fontSize: 'clamp(44px, 7.5vw, 76px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 28px', lineHeight: 1.02, letterSpacing: '-0.035em', fontFamily: 'var(--web-serif)' }}>
            {c.heroTitle}<br />
            <span className="web-gradient-text">{c.heroHighlight}</span>
          </Reveal>
          <Reveal delay={120} as="p" style={{ fontSize: '20px', color: 'var(--web-text-secondary)', maxWidth: '700px', margin: '0 auto 52px', lineHeight: 1.75 }}>
            {c.heroSubtitle}
          </Reveal>
          <Reveal delay={180}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '72px' }}>
              <Link href="/contact" className="web-btn-primary" style={{ padding: '16px 40px', fontSize: '16px', gap: 10 }}>Request a Demo <ArrowRight size={18} /></Link>
              <Link href="/services" className="web-btn-outline" style={{ padding: '16px 40px', fontSize: '16px' }}>Explore Services</Link>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
              {c.heroBadges.map((b) => (
                <span key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--web-text-muted)' }}>
                  <Icon name="check" size={15} color="#38BDF8" /> {b}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      {/* ════════════════════ INDUSTRY MARQUEE ════════════════════ */}
      <section style={{ borderTop: '1px solid var(--web-border)', borderBottom: '1px solid var(--web-border)', padding: '20px 0', background: 'rgba(255,255,255,0.01)' }}>
        <MarqueeStrip items={MARQUEE_ITEMS} />
      </section>

      {/* ════════════════════ ANIMATED STATS ════════════════════ */}
      <section aria-label="Key statistics" style={{ padding: '80px 24px', background: 'rgba(33,115,255,0.045)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px' }}>
          <Reveal style={{ textAlign: 'center' }}>
            <CountUp end={500} suffix="+" style={{ fontSize: '64px' }} />
            <p style={{ margin: '12px 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--web-text)' }}>Questions per Assessment</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)' }}>Fisher-Yates shuffled bank</p>
          </Reveal>
          <Reveal delay={60} style={{ textAlign: 'center' }}>
            <CountUp end={25} style={{ fontSize: '64px' }} />
            <p style={{ margin: '12px 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--web-text)' }}>Questions per Candidate</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)' }}>Unique set every time</p>
          </Reveal>
          <Reveal delay={120} style={{ textAlign: 'center' }}>
            <CountUp end={67} suffix="+" style={{ fontSize: '64px' }} />
            <p style={{ margin: '12px 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--web-text)' }}>Assessment Types</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)' }}>Across 12 industry groups</p>
          </Reveal>
          <Reveal delay={180} style={{ textAlign: 'center' }}>
            <CountUp end={100} suffix="%" style={{ fontSize: '64px' }} />
            <p style={{ margin: '12px 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--web-text)' }}>Proctor-Reviewed</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)' }}>No auto-publish ever</p>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════ FEATURES ════════════════════ */}
      <section style={{ padding: '120px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Platform Capabilities</div>
          <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Why assessexpert?</h2>
          <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Built for companies that need verified, structured evidence — not gut feel — before every hire.
          </p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {c.features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 60}>
              <article className="web-card web-tilt" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${f.accent}, transparent)` }} />
                <div className="web-icon-tile" style={{ width: 52, height: 52, background: `${f.accent}18`, border: `1px solid ${f.accent}30`, marginBottom: 20 }}>
                  <Icon name={f.icon} size={24} color={f.accent} />
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: 'var(--web-text)', letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.75 }}>{f.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════════ ANIMATED WORKFLOW ════════════════════ */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '120px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '80px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>The Assessment Lifecycle</div>
            <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>How It Works</h2>
            <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
              Every assessment follows a precise, repeatable 6-step protocol — from scheduling to published report.
            </p>
          </Reveal>
          <WorkflowTimeline steps={WORKFLOW_STEPS} />
        </div>
      </section>

      {/* ════════════════════ SECURITY & INTEGRITY ════════════════════ */}
      <section style={{ padding: '120px 24px', position: 'relative', overflow: 'hidden' }}>
        <div className="web-glow-orb" style={{ width: '500px', height: '500px', background: 'rgba(56,189,248,0.1)', top: '0', right: '-100px' }} />
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '60px', alignItems: 'center' }}>
            <Reveal>
              <div className="web-label" style={{ marginBottom: '16px' }}>Anti-Cheat & Integrity</div>
              <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.1, fontFamily: 'var(--web-serif)' }}>Every Session.<br />Fully Monitored.</h2>
              <div className="web-divider" />
              <p style={{ fontSize: '16px', color: 'var(--web-text-secondary)', lineHeight: 1.8, marginBottom: '32px' }}>
                AI proctoring works alongside a human proctor to catch anomalies in real-time. Every flag is reviewed before it affects the report. No false accusations, no auto-fails.
              </p>
              <Link href="/services" className="web-btn-primary" style={{ padding: '14px 32px', fontSize: '14px', gap: 8 }}>See All Security Features <ArrowRight size={16} /></Link>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {SECURITY_FEATURES.map((sf, i) => (
                <Reveal key={sf.title} delay={(i % 2) * 60}>
                  <div className="web-card-glow">
                    <div className="web-card-glow-inner">
                      <div className="web-icon-tile web-pulse" style={{ width: 44, height: 44, background: 'var(--web-gold-dim)', border: '1px solid rgba(59,141,255,0.28)', marginBottom: 16 }}>
                        <Icon name={sf.icon} size={20} color="#38BDF8" />
                      </div>
                      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: 'var(--web-text)' }}>{sf.title}</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-secondary)', lineHeight: 1.65 }}>{sf.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ INDUSTRIES ════════════════════ */}
      <section style={{ padding: '120px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Industry Coverage</div>
          <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Any Industry. Any Job Role.</h2>
          <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Our Exam Setup team builds and maintains question banks and practical tasks for any job role — from AutoCAD Draftsman to Python Developer to HR Generalist.
          </p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {c.industries.map((ind, i) => (
            <Reveal key={ind.name} delay={(i % 4) * 40}>
              <div className="web-card web-tilt" style={{ padding: '24px', height: '100%' }}>
                <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--web-text)', fontFamily: 'var(--web-serif)' }}>{ind.name}</p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-secondary)', lineHeight: 1.6 }}>{ind.roles}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════════ PLATFORM HIGHLIGHTS ════════════════════ */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '120px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>What Sets Us Apart</div>
            <h2 style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Not Another Quiz Tool</h2>
            <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', maxWidth: '580px', margin: '0 auto', lineHeight: 1.7 }}>
              assessexpert is a managed assessment service with a proctor at the center of every session.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {[
              { title: 'Proctor-First, Always', desc: 'No assessment starts without a certified proctor completing the pre-exam checklist. The proctor controls the session lifecycle — not the candidate, not the system.', accent: 'var(--web-gold)' },
              { title: 'Two-Phase Exam Guarantee', desc: 'MCQ theory is always followed by a practical task. The sequence is enforced by the platform. No shortcuts, no theory-only reports.', accent: '#059669' },
              { title: 'Reports That Show Everything', desc: 'Every question asked. Every answer given. Correct or wrong. Practical quality rating. Integrity score. AI narrative. Proctor sign-off.', accent: '#38BDF8' },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div className="web-card-glow" style={{ height: '100%' }}>
                  <div className="web-card-glow-inner" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ width: '40px', height: '3px', background: item.accent, borderRadius: '2px', marginBottom: '24px' }} />
                    <h3 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 700, color: 'var(--web-text)', fontFamily: 'var(--web-serif)' }}>{item.title}</h3>
                    <p style={{ margin: 0, fontSize: '15px', color: 'var(--web-text-secondary)', lineHeight: 1.75 }}>{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ TRUST SIGNALS ════════════════════ */}
      <section style={{ padding: '120px 24px', position: 'relative' }}>
        <div className="web-glow-orb animate" style={{ width: '400px', height: '400px', background: 'rgba(33,115,255,0.12)', bottom: '0', left: '-100px' }} />
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Built for Trust</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Every Result. Verified.</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
            {c.trust.map((t, i) => (
              <Reveal key={t.title} delay={i * 50}>
                <div className="web-card" style={{ textAlign: 'center', padding: '40px 24px', height: '100%' }}>
                  <div className="web-icon-tile web-pulse" style={{ width: 56, height: 56, margin: '0 auto 16px', background: `${t.accent}15`, border: `1px solid ${t.accent}30` }}>
                    <Icon name={t.icon} size={26} color={t.accent} />
                  </div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: 'var(--web-text)' }}>{t.title}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-muted)', lineHeight: 1.7 }}>{t.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ FAQ ACCORDION ════════════════════ */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '120px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Common Questions</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Frequently Asked</h2>
            <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', margin: 0, lineHeight: 1.7 }}>
              Everything you need to know about the platform.
            </p>
          </Reveal>
          <Reveal>
            <Accordion items={FAQ_ITEMS} />
          </Reveal>
        </div>
      </section>

      {/* ════════════════════ CTA ════════════════════ */}
      <section style={{ padding: '140px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="web-glow-orb animate" style={{ width: '600px', height: '600px', background: 'rgba(33,115,255,0.14)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', ...CENTERED_ORB_STYLE }} />
        <div className="web-particle" style={{ width: '5px', height: '5px', top: '20%', left: '20%', ...particleMotion('20s', '0s') }} />
        <div className="web-particle" style={{ width: '3px', height: '3px', top: '30%', right: '25%', ...particleMotion('16s', '4s') }} />
        <Reveal style={{ position: 'relative', maxWidth: '720px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '28px' }}>Get Started</div>
          <h2 style={{ fontSize: 'clamp(36px,5.5vw,56px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.08, fontFamily: 'var(--web-serif)' }}>{c.ctaTitle}</h2>
          <p style={{ color: 'var(--web-text-secondary)', fontSize: '18px', marginBottom: '48px', lineHeight: 1.75 }}>
            {c.ctaSubtitle}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contact" className="web-btn-primary" style={{ padding: '18px 44px', fontSize: '16px', gap: 10 }}>Get in Touch <ArrowRight size={18} /></Link>
            <Link href="/about" className="web-btn-outline" style={{ padding: '18px 44px', fontSize: '16px' }}>Learn About Us</Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
