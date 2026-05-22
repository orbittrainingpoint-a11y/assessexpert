'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsPageRow } from '@/lib/cms-admin-api'

export default function CmsPagesList() {
  const [pages, setPages] = useState<CmsPageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cmsApi.listPages().then(setPages).finally(() => setLoading(false))
  }, [])

  return (
    <CmsShell title="Pages">
      <p style={{ color: '#94A3B8', margin: '-16px 0 28px', fontSize: 15 }}>
        Edit hero copy and SEO metadata for each marketing page. Section content falls back to built-in defaults when left blank.
      </p>
      {loading ? (
        <Loader2 size={24} className="cms-spin" color="#60A5FA" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pages.map((p) => (
            <Link key={p.slug} href={`/cms/pages/${p.slug}`} style={{ textDecoration: 'none' }}>
              <div className="cms-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', textTransform: 'capitalize' }}>{p.title || p.slug}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 9999, color: p.status === 'PUBLISHED' ? '#34D399' : '#FBBF24', background: p.status === 'PUBLISHED' ? 'rgba(5,150,105,0.15)' : 'rgba(217,119,6,0.15)' }}>{p.status}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>/{p.slug === 'home' ? '' : p.slug} · {p.metaTitle || 'No SEO title set'}</p>
                </div>
                <ChevronRight size={20} color="#475569" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </CmsShell>
  )
}
