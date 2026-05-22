import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { Icon } from '@/components/marketing/icons'
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
      {
        '@type': 'WebSite',
        name: SITE.name,
        url: SITE.url,
      },
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
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', overflowX: 'hidden' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />

      {/* HERO */}
      <header style={{ position: 'relative', padding: '140px 24px 120px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '600px', height: '600px', background: 'rgba(29,78,216,0.15)', top: '-200px', left: '50%', ['--ox' as any]: '-50%', transform: 'translateX(-50%)' }} />
        <div className="web-glow-orb animate" style={{ width: '300px', height: '300px', background: 'rgba(59,130,246,0.1)', top: '100px', left: '8%' }} />
        <div className="web-glow-orb animate" style={{ width: '300px', height: '300px', background: 'rgba(109,40,217,0.08)', top: '120px', right: '8%' }} />

        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
          <Reveal><div className="web-label" style={{ marginBottom: '28px' }}>{c.heroBadge}</div></Reveal>
          <Reveal delay={60} as="h1" style={{ fontSize: 'clamp(40px, 7vw, 68px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 28px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            {c.heroTitle}<br />
            <span className="web-gradient-text">{c.heroHighlight}</span>
          </Reveal>
          <Reveal delay={120} as="p" style={{ fontSize: '19px', color: '#94A3B8', maxWidth: '660px', margin: '0 auto 48px', lineHeight: 1.75 }}>
            {c.heroSubtitle}
          </Reveal>
          <Reveal delay={180}>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '64px' }}>
              <Link href="/contact" className="web-btn-primary" style={{ padding: '14px 36px', fontSize: '16px', gap: 8 }}>Request a Demo <ArrowRight size={18} /></Link>
              <Link href="/services" className="web-btn-outline" style={{ padding: '14px 36px', fontSize: '16px' }}>Explore Services</Link>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap' }}>
              {c.heroBadges.map((b) => (
                <span key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B' }}>
                  <Icon name="check" size={15} color="#3B82F6" /> {b}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      {/* STATS */}
      <section aria-label="Key statistics" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(59,130,246,0.1)', borderBottom: '1px solid rgba(59,130,246,0.1)', padding: '56px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '40px' }}>
          {c.stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 40} style={{ textAlign: 'center' }}>
              <div className="web-stat-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <p style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: 600, color: '#E2E8F0' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{s.sub}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '120px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Platform Capabilities</div>
          <h2 style={{ fontSize: 'clamp(32px,5vw,44px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Why assessexpert?</h2>
          <p style={{ fontSize: '17px', color: '#64748B', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Built for companies that need verified, structured evidence — not gut feel — before every hire.
          </p>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {c.features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 60}>
              <article className="web-card" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${f.accent}, transparent)` }} />
                <div className="web-icon-tile" style={{ width: 48, height: 48, background: `${f.accent}18`, border: `1px solid ${f.accent}30`, marginBottom: 20 }}>
                  <Icon name={f.icon} size={22} color={f.accent} />
                </div>
                <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: 1.75 }}>{f.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '120px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>The Assessment Lifecycle</div>
            <h2 style={{ fontSize: 'clamp(32px,5vw,44px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 16px', letterSpacing: '-0.02em' }}>How It Works</h2>
            <p style={{ fontSize: '17px', color: '#64748B', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
              Every assessment follows a precise, repeatable 6-step protocol — from scheduling to published report.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2px', background: 'rgba(59,130,246,0.08)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(59,130,246,0.12)' }}>
            {c.process.map((p, i) => (
              <Reveal key={p.step} delay={(i % 3) * 50} style={{ background: '#040814' }}>
                <div style={{ padding: '40px 36px', position: 'relative', height: '100%' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#3B82F6', letterSpacing: '0.1em', marginBottom: '16px' }}>STEP {p.step}</div>
                  <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 700, color: '#F1F5F9' }}>{p.title}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: 1.7 }}>{p.desc}</p>
                  <span style={{ position: 'absolute', top: '36px', right: '36px', width: '32px', height: '32px', background: 'rgba(59,130,246,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#3B82F6' }}>{p.step}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section style={{ padding: '120px 24px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '60px', alignItems: 'center' }}>
          <Reveal>
            <div className="web-label" style={{ marginBottom: '16px' }}>Industry Coverage</div>
            <h2 style={{ fontSize: 'clamp(32px,5vw,44px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Any Industry.<br />Any Job Role.</h2>
            <div className="web-divider" />
            <p style={{ fontSize: '16px', color: '#64748B', lineHeight: 1.8, marginBottom: '32px' }}>
              assessexpert is not limited to one sector. Our Exam Setup team builds and maintains question banks and practical tasks for any job role — from AutoCAD Draftsman to Python Developer to HR Generalist.
            </p>
            <Link href="/services" className="web-btn-primary" style={{ padding: '12px 28px', fontSize: '14px', gap: 8 }}>View All Assessment Types <ArrowRight size={16} /></Link>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {c.industries.map((ind, i) => (
              <Reveal key={ind.name} delay={(i % 2) * 40}>
                <div className="web-card" style={{ padding: '20px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>{ind.name}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{ind.roles}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section style={{ background: 'linear-gradient(180deg, rgba(29,78,216,0.06) 0%, rgba(4,8,20,0) 100%)', borderTop: '1px solid rgba(59,130,246,0.1)', padding: '100px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Built for Trust</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>Every Result. Verified.</h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
            {c.trust.map((t, i) => (
              <Reveal key={t.title} delay={i * 50}>
                <div className="web-card" style={{ textAlign: 'center', padding: '36px 24px', height: '100%' }}>
                  <div className="web-icon-tile" style={{ width: 56, height: 56, margin: '0 auto 16px', background: `${t.accent}15`, border: `1px solid ${t.accent}30` }}>
                    <Icon name={t.icon} size={26} color={t.accent} />
                  </div>
                  <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, color: '#E2E8F0' }}>{t.title}</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>{t.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '120px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(29,78,216,0.12)', top: '50%', left: '50%', ['--ox' as any]: '-50%', transform: 'translate(-50%, -50%)' }} />
        <Reveal style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '24px' }}>Get Started</div>
          <h2 style={{ fontSize: 'clamp(34px,5vw,48px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Ready to transform<br />your hiring process?</h2>
          <p style={{ color: '#64748B', fontSize: '17px', marginBottom: '40px', lineHeight: 1.7 }}>
            No self-signup. No payment page. Every client relationship starts with a conversation with our team.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/contact" className="web-btn-primary" style={{ padding: '16px 40px', fontSize: '16px', gap: 8 }}>Get in Touch <ArrowRight size={18} /></Link>
            <Link href="/about" className="web-btn-outline" style={{ padding: '16px 40px', fontSize: '16px' }}>Learn About Us</Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  )
}
