import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Mail, Phone, MapPin, Globe } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { ContactForm } from '@/components/marketing/ContactForm'
import { getMarketingPageContent, getPageMeta } from '@/lib/cms'
import { SITE } from '@/lib/marketing-content'

export async function generateMetadata(): Promise<Metadata> {
  const m = await getPageMeta('contact')
  return {
    title: m.metaTitle, description: m.metaDescription, keywords: m.keywords,
    alternates: { canonical: `${SITE.url}/contact` },
    openGraph: { title: m.metaTitle, description: m.metaDescription, url: `${SITE.url}/contact`, siteName: SITE.name, type: 'website' },
  }
}

const CONTACT_INFO = [
  { Icon: Mail, label: 'Email', value: SITE.email, sub: 'We respond within 1 business day' },
  { Icon: Phone, label: 'Phone / WhatsApp', value: SITE.phone, sub: 'Sun – Thu · 9AM – 6PM GST' },
  { Icon: MapPin, label: 'Location', value: SITE.location, sub: 'Orbit Training HQ' },
  { Icon: Globe, label: 'Website', value: 'assessexpert.ae', sub: 'app.assessexpert.ae for portal' },
]

const PROCESS_STEPS = [
  { n: '1', title: 'Submit Form', desc: 'Fill in your details and assessment needs' },
  { n: '2', title: 'Sales Contact', desc: 'Our team reaches out within 1 business day' },
  { n: '3', title: 'Live Demo', desc: 'We walk you through the full platform' },
  { n: '4', title: 'Agreement', desc: 'Commercial agreement — no payment page' },
  { n: '5', title: 'Onboarded', desc: 'Your company is live on assessexpert' },
]

const CENTERED_ORB_STYLE = { '--ox': '-50%' } as CSSProperties

export default async function ContactPage() {
  const content = await getMarketingPageContent('contact')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--web-bg)', fontFamily: 'var(--web-sans)', overflowX: 'hidden' }}>
      <SiteNav />

      <header style={{ position: 'relative', padding: '100px 24px 80px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '400px', height: '400px', background: 'rgba(33,115,255,0.18)', top: '-100px', left: '50%', transform: 'translateX(-50%)', ...CENTERED_ORB_STYLE }} />
        <Reveal style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '20px' }}>{content.heroBadge}</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,60px)', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.05, fontFamily: 'var(--web-serif)' }}>
            {content.heroTitle} <span className="web-gradient-text">{content.heroHighlight}</span>
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--web-text-secondary)', lineHeight: 1.75, margin: 0 }}>
            {content.heroSubtitle}
          </p>
        </Reveal>
      </header>

      {/* PROCESS */}
      <section style={{ padding: '0 24px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2px', background: 'rgba(33,115,255,0.08)', border: '1px solid rgba(59,141,255,0.18)', borderRadius: '20px', overflow: 'hidden' }}>
            {PROCESS_STEPS.map((s) => (
              <div key={s.n} style={{ padding: '28px 24px', textAlign: 'center', background: 'var(--web-bg)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--web-gold-dim)', border: '1px solid rgba(59,141,255,0.32)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--web-gold)', margin: '0 auto 12px' }}>{s.n}</div>
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: 'var(--web-text)' }}>{s.title}</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* MAIN */}
      <section style={{ padding: '0 24px 100px', maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '60px', alignItems: 'start' }}>
        <Reveal>
          <div className="web-label" style={{ marginBottom: '20px' }}>Contact Details</div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--web-text)', margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: 'var(--web-serif)' }}>{content.introTitle}</h2>
          <div className="web-divider" />
          <p style={{ fontSize: '15px', color: 'var(--web-text-secondary)', lineHeight: 1.8, marginBottom: '40px' }}>
            {content.introSubtitle}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
            {CONTACT_INFO.map((c) => (
              <div key={c.label} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--web-border)', borderRadius: '12px' }}>
                <div style={{ width: 40, height: 40, background: 'var(--web-gold-dim)', border: '1px solid rgba(59,141,255,0.28)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <c.Icon size={18} color="#38BDF8" />
                </div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'var(--web-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{c.label}</p>
                  <p style={{ margin: '0 0 2px', fontSize: '15px', color: 'var(--web-text)', fontWeight: 600 }}>{c.value}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--web-text-muted)' }}>{c.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '24px', background: 'rgba(33,115,255,0.06)', border: '1px solid rgba(59,141,255,0.18)', borderRadius: '16px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: 'var(--web-gold)' }}>How it works</p>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-secondary)', lineHeight: 1.7 }}>
              {content.processNote}
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div style={{ padding: '48px', background: 'rgba(255,255,255,0.025)', border: '1px solid var(--web-border)', borderRadius: '20px' }}>
            <ContactForm />
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
