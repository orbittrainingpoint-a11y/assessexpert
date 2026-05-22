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
  const m = await getPageMeta('about')
  return {
    title: m.metaTitle, description: m.metaDescription, keywords: m.keywords,
    alternates: { canonical: `${SITE.url}/about` },
    openGraph: { title: m.metaTitle, description: m.metaDescription, url: `${SITE.url}/about`, siteName: SITE.name, type: 'website' },
  }
}

const VALUES: { icon: IconKey; title: string; desc: string; accent: string }[] = [
  { icon: 'target', title: 'Precision over Speed', desc: 'Every report is reviewed by a certified proctor before it reaches HR. We never sacrifice accuracy for turnaround time.', accent: '#3B82F6' },
  { icon: 'lock', title: 'Integrity First', desc: 'AI proctoring, facial recognition, and screen recording work together to ensure every result reflects genuine candidate ability.', accent: '#6D28D9' },
  { icon: 'handshake', title: 'B2B Partnership', desc: 'We work directly with companies — no public marketplace, no self-signup. Every client relationship starts with a conversation.', accent: '#059669' },
  { icon: 'globe', title: 'Built for the Region', desc: 'Headquartered in Dubai, built for the GCC and global markets. Full Arabic and English support across all portals.', accent: '#D97706' },
]

const TEAM_ROLES = [
  { role: 'Super Admin', desc: 'Full platform control — manages all companies, users, and platform settings.', color: '#E11D48' },
  { role: 'Master Proctor', desc: 'Senior operational lead — oversees all sessions, manages proctors, reviews escalated reports.', color: '#3B82F6' },
  { role: 'Exam Setup Master', desc: 'Content lead — builds and maintains the 500-question banks and practical task library.', color: '#6D28D9' },
  { role: 'Certified Proctor', desc: 'Session controller — runs the pre-exam checklist, monitors live sessions, reviews and publishes reports.', color: '#059669' },
  { role: 'Sales Agent', desc: 'Client pipeline — manages leads, demos, and company onboarding.', color: '#D97706' },
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

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', overflowX: 'hidden' }}>
      <SiteNav />

      <header style={{ position: 'relative', padding: '120px 24px 100px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(29,78,216,0.12)', top: '-150px', left: '50%', ['--ox' as any]: '-50%', transform: 'translateX(-50%)' }} />
        <Reveal style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '20px' }}>Our Story</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,60px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            About <span className="web-gradient-text">assessexpert</span>
          </h1>
          <p style={{ fontSize: '18px', color: '#94A3B8', lineHeight: 1.75, margin: '0 auto', maxWidth: '640px' }}>
            A global B2B SaaS pre-employment assessment platform built by {SITE.org}, Dubai. We enable companies in any industry to conduct structured, AI-proctored technical assessments — producing verified, human-reviewed reports.
          </p>
        </Reveal>
      </header>

      {/* MISSION */}
      <section style={{ padding: '60px 24px 0', maxWidth: '1100px', margin: '0 auto' }}>
        <Reveal>
          <div style={{ position: 'relative', padding: '56px 48px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '20px', textAlign: 'center', overflow: 'hidden' }}>
            <div className="web-glow-orb" style={{ width: '300px', height: '300px', background: 'rgba(59,130,246,0.08)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.4, color: '#3B82F6', fontFamily: 'Georgia, serif', lineHeight: 1 }}>&ldquo;</div>
              <p style={{ fontSize: '22px', fontWeight: 600, color: '#E2E8F0', lineHeight: 1.65, margin: '0 auto 24px', maxWidth: '700px' }}>
                We believe hiring decisions should be based on verified, structured evidence — not gut feel. assessexpert gives HR teams the truth about every candidate.
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 500 }}>— assessexpert · {SITE.org} · Dubai, UAE</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* IS / IS NOT */}
      <section style={{ padding: '100px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Clarity</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>What assessexpert Is &amp; Is Not</h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <Reveal>
            <div style={{ padding: '40px', background: 'rgba(5,150,105,0.04)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '16px', height: '100%' }}>
              <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Check size={20} /> What assessexpert IS
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {IS.map((item) => (
                  <div key={item} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <ArrowRight size={15} color="#059669" style={{ marginTop: 3, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ padding: '40px', background: 'rgba(225,29,72,0.04)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '16px', height: '100%' }}>
              <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 700, color: '#E11D48', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <X size={20} /> What assessexpert IS NOT
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {IS_NOT.map((item) => (
                  <div key={item} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <X size={15} color="#E11D48" style={{ marginTop: 3, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '14px', color: '#94A3B8', lineHeight: 1.6 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* VALUES */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>What Drives Us</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>Our Values</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={(i % 2) * 60}>
                <div className="web-card" style={{ display: 'flex', gap: '20px', position: 'relative', overflow: 'hidden', height: '100%' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '3px', background: v.accent }} />
                  <div className="web-icon-tile" style={{ width: 52, height: 52, background: `${v.accent}15`, border: `1px solid ${v.accent}25`, flexShrink: 0, marginLeft: 8 }}>
                    <Icon name={v.icon} size={24} color={v.accent} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700, color: '#F1F5F9' }}>{v.title}</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: 1.75 }}>{v.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section style={{ padding: '100px 24px', maxWidth: '1100px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>The People Behind Every Assessment</div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Our Team Structure</h2>
          <p style={{ color: '#475569', fontSize: '16px', margin: 0 }}>Every assessment is backed by a dedicated team of specialists.</p>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {TEAM_ROLES.map((t, i) => (
            <Reveal key={t.role} delay={i * 40}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px 32px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', flexWrap: 'wrap' }}>
                <div style={{ width: '40px', height: '40px', background: `${t.color}15`, border: `1px solid ${t.color}30`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: t.color, flexShrink: 0 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: t.color, minWidth: '180px' }}>{t.role}</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: 1.6, flex: 1 }}>{t.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* TIMELINE */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Our Journey</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>Milestones</h2>
          </Reveal>
          <div style={{ position: 'relative', paddingLeft: '40px' }}>
            <div style={{ position: 'absolute', left: '15px', top: 0, bottom: 0, width: '1px', background: 'linear-gradient(180deg, #3B82F6, rgba(59,130,246,0.1))' }} />
            {MILESTONES.map((m, i) => (
              <Reveal key={m.year} delay={i * 50} style={{ position: 'relative', marginBottom: i < MILESTONES.length - 1 ? '40px' : 0 }}>
                <div style={{ position: 'absolute', left: '-32px', top: '4px', width: '14px', height: '14px', background: '#3B82F6', borderRadius: '50%', border: '3px solid #040814', boxShadow: '0 0 12px rgba(59,130,246,0.5)' }} />
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#3B82F6', minWidth: '48px', paddingTop: '2px' }}>{m.year}</span>
                  <p style={{ margin: 0, fontSize: '15px', color: '#94A3B8', lineHeight: 1.6 }}>{m.event}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Want to work with us?</h2>
          <p style={{ color: '#64748B', fontSize: '16px', marginBottom: '36px', lineHeight: 1.7 }}>All client relationships start with a conversation — no self-signup, no payment page.</p>
          <Link href="/contact" className="web-btn-primary" style={{ padding: '14px 40px', fontSize: '16px', gap: 8 }}>Get in Touch <ArrowRight size={18} /></Link>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
