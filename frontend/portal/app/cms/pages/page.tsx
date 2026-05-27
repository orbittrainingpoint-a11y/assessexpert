'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsPageRow } from '@/lib/cms-admin-api'

export default function CmsPagesList() {
  const [pages, setPages] = useState<CmsPageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cmsApi.listPages().then(setPages).catch(() => setError('Could not load website pages.')).finally(() => setLoading(false))
  }, [])

  return (
    <CmsShell title="Pages">
      <p className="cms-copy" style={{ margin: '-16px 0 28px' }}>
        Edit public page copy and SEO metadata. Published changes appear on the matching page within about one minute.
      </p>
      {error && <div className="cms-alert">{error}</div>}
      {loading ? (
        <Loader2 size={24} className="cms-spin" color="#60A5FA" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pages.map((p) => (
            <Link key={p.slug} href={`/cms/pages/${p.slug}`} style={{ textDecoration: 'none' }}>
              <div className="cms-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--web-text)', textTransform: 'capitalize' }}>{p.title || p.slug}</span>
                    <span className={`cms-status ${p.status === 'PUBLISHED' ? 'published' : 'draft'}`}>{p.status}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--web-text-muted)' }}>/{p.slug === 'home' ? '' : p.slug} | {p.metaTitle || 'No SEO title set'}</p>
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
