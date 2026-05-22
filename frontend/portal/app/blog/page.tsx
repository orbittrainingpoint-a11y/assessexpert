import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'
import { SiteNav } from '@/components/marketing/SiteNav'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { Reveal } from '@/components/marketing/Reveal'
import { getPosts, getPageMeta } from '@/lib/cms'
import { SITE, PAGE_META } from '@/lib/marketing-content'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const m = await getPageMeta('blog').catch(() => PAGE_META.blog)
  return {
    title: m.metaTitle, description: m.metaDescription, keywords: m.keywords,
    alternates: { canonical: `${SITE.url}/blog` },
    openGraph: { title: m.metaTitle, description: m.metaDescription, url: `${SITE.url}/blog`, siteName: SITE.name, type: 'website' },
  }
}

function fmtDate(d?: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', overflowX: 'hidden' }}>
      <SiteNav />

      <header style={{ position: 'relative', padding: '120px 24px 80px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb animate" style={{ width: '500px', height: '500px', background: 'rgba(29,78,216,0.12)', top: '-150px', left: '50%', ['--ox' as any]: '-50%', transform: 'translateX(-50%)' }} />
        <Reveal style={{ position: 'relative', maxWidth: '760px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '20px' }}>Insights</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,60px)', fontWeight: 800, color: '#F1F5F9', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            The <span className="web-gradient-text">Blog</span>
          </h1>
          <p style={{ fontSize: '17px', color: '#94A3B8', lineHeight: 1.75, margin: 0 }}>
            Insights on pre-employment assessment, proctoring, candidate integrity, and building a verified hiring pipeline.
          </p>
        </Reveal>
      </header>

      <section style={{ padding: '40px 24px 120px', maxWidth: '1180px', margin: '0 auto' }}>
        {posts.length === 0 ? (
          <Reveal>
            <div style={{ textAlign: 'center', padding: '80px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' }}>
              <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: '16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={28} color="#60A5FA" />
              </div>
              <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: '#E2E8F0' }}>No articles yet</h2>
              <p style={{ margin: 0, fontSize: '15px', color: '#64748B' }}>New insights are on the way — check back soon.</p>
            </div>
          </Reveal>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
            {posts.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 60}>
                <Link href={`/blog/${p.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                  <article className="web-card" style={{ padding: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ aspectRatio: '16 / 9', background: p.coverImage ? `center/cover no-repeat url(${p.coverImage})` : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(109,40,217,0.15))', borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {p.tags?.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          {p.tags.slice(0, 3).map((t) => (
                            <span key={t} className="web-chip" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60A5FA' }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 700, color: '#F1F5F9', lineHeight: 1.35, letterSpacing: '-0.01em' }}>{p.title}</h2>
                      {p.excerpt && <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#64748B', lineHeight: 1.7, flex: 1 }}>{p.excerpt}</p>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>{p.authorName ? `${p.authorName} · ` : ''}{fmtDate(p.publishedAt)}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '13px', color: '#60A5FA', fontWeight: 600 }}>Read <ArrowRight size={14} /></span>
                      </div>
                    </div>
                  </article>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  )
}
