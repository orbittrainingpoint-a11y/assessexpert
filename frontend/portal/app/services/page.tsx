import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, X } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { Icon } from '@/components/marketing/icons'
import { getPageMeta } from '@/lib/cms'
import { SITE, type IconKey } from '@/lib/marketing-content'

export async function generateMetadata(): Promise<Metadata> {
  const m = await getPageMeta('services')
  return {
    title: m.metaTitle, description: m.metaDescription, keywords: m.keywords,
    alternates: { canonical: `${SITE.url}/services` },
    openGraph: { title: m.metaTitle, description: m.metaDescription, url: `${SITE.url}/services`, siteName: SITE.name, type: 'website' },
  }
}

const SERVICES: { icon: IconKey; title: string; duration: string; desc: string; tags: string[]; accent: string }[] = [
  { icon: 'flask', title: 'MCQ Theory Assessment', duration: '30 minutes · 25 questions', desc: 'Candidates answer 25 randomly selected questions from a 500-question bank. Fisher-Yates shuffle ensures no two candidates receive the same paper. One question at a time, server-side delivery — no bulk download possible.', tags: ['500-question bank', 'Fisher-Yates shuffle', 'Server-side delivery', 'Anti-cheat'], accent: '#C8A44E' },
  { icon: 'wrench', title: 'Practical Assessment', duration: '60 minutes · Role-specific task', desc: 'Candidates complete a hands-on task matched to the job role — CAD drawings, coding challenges, lab simulations, or file-based submissions. Evaluated against a structured rubric by a certified proctor.', tags: ['CAD / BIM', 'Coding', 'Lab simulation', 'File submission'], accent: '#059669' },
  { icon: 'eye', title: 'AI Proctoring & Facial Recognition', duration: 'Full session · Real-time', desc: 'Continuous face detection, gaze tracking, audio anomaly detection, tab-switch monitoring, and screen recording. AI flags events; a human proctor reviews every flag before it affects the report.', tags: ['Face detection', 'Gaze tracking', 'Screen recording', 'Human review'], accent: '#6366F1' },
  { icon: 'file-text', title: 'AI-Generated Assessment Reports', duration: 'Post-session · Proctor-reviewed', desc: 'After every session, AI drafts a full report including MCQ score breakdown, question-by-question answer review, practical quality rating, integrity score, and a hiring recommendation. A proctor reviews and publishes — reports never auto-publish.', tags: ['Full answer breakdown', 'Integrity score', 'AI narrative', 'Proctor sign-off'], accent: '#D97706' },
  { icon: 'building', title: 'Multi-Tenant HR Portal', duration: 'Always-on · Per company', desc: 'Each client company gets a fully isolated HR portal. Upload candidates, schedule assessments, track live sessions, and access published reports — all within your own tenant. No cross-company data leakage, ever.', tags: ['Tenant isolation', 'Candidate upload', 'Live tracking', 'Report access'], accent: '#C8A44E' },
  { icon: 'globe', title: 'Global Delivery · Any Industry', duration: 'Any country · Any job role', desc: 'assessexpert is not limited to one industry. Engineering, IT, Finance, HR, Operations — any job role can be assessed. Available globally with IP-based localization and Arabic/English support.', tags: ['Any industry', 'Arabic + English', 'Global IP access', 'Custom types'], accent: '#E11D48' },
]

const ASSESSMENT_TYPES = [
  { cat: 'Engineering & Construction', roles: 'AutoCAD Draftsman L1/L2, BIM Coordinator, MEP Engineer, Structural Engineer, Civil Designer', count: '12+' },
  { cat: 'Information Technology', roles: 'Python Developer, JavaScript Developer, Network Engineer, IT Support, Cybersecurity Analyst', count: '10+' },
  { cat: 'Finance & Accounting', roles: 'Accountant L1/L2, Financial Analyst, Auditor, Bookkeeper', count: '6+' },
  { cat: 'Human Resources', roles: 'HR Generalist, Talent Acquisition Specialist, L&D Coordinator, HRBP', count: '5+' },
  { cat: 'Operations & Management', roles: 'Project Manager, Operations Manager, Supply Chain Analyst, Planning Engineer', count: '8+' },
  { cat: 'Design & Creative', roles: 'UI/UX Designer, Graphic Designer, Brand Designer, 3D Visualizer, Interior Designer', count: '7+' },
  { cat: 'Data & Analytics', roles: 'Data Analyst, BI Analyst, Power BI Developer, SQL Developer', count: '5+' },
  { cat: 'Administration', roles: 'Office Administrator, Executive Assistant, Data Entry Specialist', count: '4+' },
  { cat: 'Custom Roles', roles: 'Any job role — our Exam Setup team builds the assessment to your exact specification', count: '∞' },
]

const COMPARISON = [
  { feature: 'Proctor-controlled session lifecycle', us: true, others: false },
  { feature: 'Two-phase exam (MCQ + Practical)', us: true, others: false },
  { feature: '500-question bank with shuffle', us: true, others: false },
  { feature: 'Full question-by-question report', us: true, others: false },
  { feature: 'AI report + human proctor review', us: true, others: false },
  { feature: 'Screen + webcam recording', us: true, others: true },
  { feature: 'Multi-tenant data isolation', us: true, others: true },
  { feature: 'No auto-publish — proctor signs off', us: true, others: false },
]

function Mark({ on }: { on: boolean }) {
  return on
    ? <Check size={18} color="#059669" aria-label="Yes" />
    : <X size={18} color="#E11D48" aria-label="No" />
}

export default function ServicesPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <SiteNav />

      <header style={{ position: 'relative', padding: '120px 24px 100px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(200,164,78,0.08)', top: '-150px', left: '50%', ['--ox' as any]: '-50%', transform: 'translateX(-50%)' }} />
        <Reveal style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '20px' }}>What We Offer</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,60px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.05, fontFamily: 'var(--web-serif)' }}>
            Our <span className="web-gradient-text">Services</span>
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--web-text-secondary)', lineHeight: 1.75, margin: '0 auto', maxWidth: '600px' }}>
            A complete managed assessment service — from candidate scheduling to published report. Every step is structured, every session is proctored, every report is human-reviewed.
          </p>
        </Reveal>
      </header>

      {/* SERVICES GRID */}
      <section style={{ padding: '100px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={(i % 2) * 60}>
              <article className="web-card" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${s.accent}, transparent)` }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '16px' }}>
                  <div className="web-icon-tile" style={{ width: 52, height: 52, background: `${s.accent}15`, border: `1px solid ${s.accent}25`, flexShrink: 0 }}>
                    <Icon name={s.icon} size={24} color={s.accent} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--web-text)', letterSpacing: '-0.01em' }}>{s.title}</h3>
                    <p style={{ margin: 0, fontSize: '12px', color: s.accent, fontWeight: 600 }}>{s.duration}</p>
                  </div>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--web-text-secondary)', lineHeight: 1.75 }}>{s.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {s.tags.map((t) => (
                    <span key={t} className="web-chip" style={{ background: `${s.accent}10`, border: `1px solid ${s.accent}20`, color: s.accent }}>{t}</span>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ASSESSMENT TYPES */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Coverage</div>
            <h2 style={{ fontSize: 'clamp(32px,5vw,44px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Assessment Types Available</h2>
            <p style={{ color: 'var(--web-text-muted)', fontSize: '16px', margin: 0 }}>Not limited to these — custom roles built on request by our Exam Setup team.</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {ASSESSMENT_TYPES.map((at, i) => (
              <Reveal key={at.cat} delay={(i % 3) * 50}>
                <div className="web-card" style={{ padding: '24px', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--web-text)' }}>{at.cat}</h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--web-gold)', background: 'var(--web-gold-dim)', padding: '2px 8px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>{at.count} roles</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-muted)', lineHeight: 1.6 }}>{at.roles}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section style={{ padding: '100px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Why Choose Us</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>assessexpert vs. Generic Platforms</h2>
        </Reveal>
        <Reveal>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--web-border)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', background: 'rgba(200,164,78,0.06)', padding: '16px 24px', borderBottom: '1px solid var(--web-border)' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--web-text-secondary)' }}>Feature</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--web-gold-light)', textAlign: 'center' }}>assessexpert</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--web-text-muted)', textAlign: 'center' }}>Others</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', padding: '16px 24px', alignItems: 'center', borderBottom: i < COMPARISON.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '14px', color: 'var(--web-text-secondary)' }}>{row.feature}</span>
                <span style={{ display: 'flex', justifyContent: 'center' }}><Mark on={row.us} /></span>
                <span style={{ display: 'flex', justifyContent: 'center' }}><Mark on={row.others} /></span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(200,164,78,0.08)' }}>
        <Reveal style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 16px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>Need a custom assessment type?</h2>
          <p style={{ color: 'var(--web-text-secondary)', fontSize: '16px', marginBottom: '36px', lineHeight: 1.7 }}>Our Exam Setup team builds assessments to your exact job specification — question bank, practical task, and evaluation rubric.</p>
          <Link href="/contact" className="web-btn-primary" style={{ padding: '14px 40px', fontSize: '16px', gap: 8 }}>Talk to Our Team <ArrowRight size={18} /></Link>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
