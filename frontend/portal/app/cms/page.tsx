'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileStack, Newspaper, ImageIcon, ArrowRight } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi } from '@/lib/cms-admin-api'

export default function CmsDashboard() {
  const [counts, setCounts] = useState({ pages: 0, posts: 0, published: 0, media: 0 })

  useEffect(() => {
    Promise.all([cmsApi.listPages(), cmsApi.listPosts(), cmsApi.listMedia()])
      .then(([pages, posts, media]) => setCounts({
        pages: pages.length,
        posts: posts.length,
        published: posts.filter((p) => p.status === 'PUBLISHED').length,
        media: media.length,
      }))
      .catch(() => {})
  }, [])

  const cards = [
    { href: '/cms/pages', label: 'Pages', value: counts.pages, sub: 'Marketing pages + SEO', Icon: FileStack, color: '#3B82F6' },
    { href: '/cms/posts', label: 'Blog Posts', value: counts.posts, sub: `${counts.published} published`, Icon: Newspaper, color: '#6D28D9' },
    { href: '/cms/media', label: 'Media', value: counts.media, sub: 'Images in library', Icon: ImageIcon, color: '#059669' },
  ]

  return (
    <CmsShell title="Dashboard">
      <p style={{ color: '#94A3B8', margin: '-16px 0 28px', fontSize: 15 }}>
        Manage your marketing site content, blog, SEO, and media here. Changes go live within ~1 minute.
      </p>
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
              <div style={{ fontSize: 32, fontWeight: 800, color: '#F1F5F9', lineHeight: 1 }}>{c.value}</div>
              <p style={{ margin: '8px 0 2px', fontSize: 14, fontWeight: 600, color: '#E2E8F0' }}>{c.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{c.sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </CmsShell>
  )
}
