'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileStack, Newspaper, ImageIcon, ArrowRight } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi } from '@/lib/cms-admin-api'

export default function CmsDashboard() {
  const [counts, setCounts] = useState({ pages: 0, posts: 0, published: 0, media: 0 })
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([cmsApi.listPages(), cmsApi.listPosts(), cmsApi.listMedia()])
      .then(([pages, posts, media]) => setCounts({
        pages: pages.length,
        posts: posts.length,
        published: posts.filter((p) => p.status === 'PUBLISHED').length,
        media: media.length,
      }))
      .catch(() => setError('Could not load current content totals. Try refreshing this page.'))
  }, [])

  const cards = [
    { href: '/cms/pages', label: 'Pages', value: counts.pages, sub: 'Marketing pages + SEO', Icon: FileStack, color: '#3B8DFF' },
    { href: '/cms/posts', label: 'Blog Posts', value: counts.posts, sub: `${counts.published} published`, Icon: Newspaper, color: '#38BDF8' },
    { href: '/cms/media', label: 'Media', value: counts.media, sub: 'Images in library', Icon: ImageIcon, color: '#60A5FA' },
  ]

  return (
    <CmsShell title="Dashboard">
      <p className="cms-copy" style={{ margin: '-16px 0 28px' }}>
        Manage your marketing site content, blog, SEO, and media here. Changes go live within ~1 minute.
      </p>
      {error && <div className="cms-alert">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="cms-card" style={{ transition: 'all 200ms', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: `${c.color}18`, border: `1px solid ${c.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.Icon size={22} color={c.color} />
                </div>
                <ArrowRight size={18} color="#475569" />
              </div>
              <div className="cms-stat">{c.value}</div>
              <p style={{ margin: '8px 0 2px', fontSize: 14, fontWeight: 700, color: 'var(--web-text)' }}>{c.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--web-text-muted)' }}>{c.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </CmsShell>
  )
}
