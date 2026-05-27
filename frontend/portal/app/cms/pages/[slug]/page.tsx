'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsPageRow } from '@/lib/cms-admin-api'
import { HOME, PAGE_CONTENT } from '@/lib/marketing-content'

type Field = { key: string; label: string; multiline?: boolean; hint?: string }

const COMMON_FIELDS: Field[] = [
  { key: 'heroBadge', label: 'Hero eyebrow' },
  { key: 'heroTitle', label: 'Hero title' },
  { key: 'heroHighlight', label: 'Highlighted title' },
  { key: 'heroSubtitle', label: 'Hero description', multiline: true },
]

const CONTENT_FIELDS: Record<string, Field[]> = {
  home: [...COMMON_FIELDS, { key: 'ctaTitle', label: 'Closing CTA title' }, { key: 'ctaSubtitle', label: 'Closing CTA description', multiline: true }],
  about: [...COMMON_FIELDS, { key: 'ctaTitle', label: 'Closing CTA title' }, { key: 'ctaSubtitle', label: 'Closing CTA description', multiline: true }],
  services: [...COMMON_FIELDS, { key: 'ctaTitle', label: 'Closing CTA title' }, { key: 'ctaSubtitle', label: 'Closing CTA description', multiline: true }],
  contact: [...COMMON_FIELDS, { key: 'introTitle', label: 'Contact panel title' }, { key: 'introSubtitle', label: 'Contact panel description', multiline: true }, { key: 'processNote', label: 'Process note', multiline: true }],
  blog: COMMON_FIELDS,
}

function fallbackContent(slug: string): Record<string, string> {
  if (slug === 'home') {
    return {
      heroBadge: HOME.heroBadge,
      heroTitle: HOME.heroTitle,
      heroHighlight: HOME.heroHighlight,
      heroSubtitle: HOME.heroSubtitle,
      ctaTitle: HOME.ctaTitle,
      ctaSubtitle: HOME.ctaSubtitle,
    }
  }
  return (PAGE_CONTENT[slug as keyof typeof PAGE_CONTENT] ?? {}) as unknown as Record<string, string>
}

export default function CmsPageEditor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [page, setPage] = useState<CmsPageRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cmsApi.getPage(slug)
      .then(setPage)
      .catch(() => setError('Could not load this page.'))
      .finally(() => setLoading(false))
  }, [slug])

  const set = (patch: Partial<CmsPageRow>) => setPage((p) => (p ? { ...p, ...patch } : p))
  const setContent = (k: string, v: string) => setPage((p) => (p ? { ...p, content: { ...p.content, [k]: v } } : p))
  const contentValue = (key: string) => {
    const value = page?.content?.[key]
    return typeof value === 'string' ? value : fallbackContent(slug)[key] || ''
  }

  const save = async () => {
    if (!page) return
    setSaving(true); setError(''); setSaved(false)
    try {
      const updated = await cmsApi.savePage(slug, {
        title: page.title,
        status: page.status,
        content: page.content,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        ogImage: page.ogImage,
        keywords: page.keywords,
      })
      setPage(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Save failed. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <CmsShell><Loader2 size={24} className="cms-spin" color="#60A5FA" /></CmsShell>
  if (!page) return <CmsShell title="Page"><p style={{ color: '#FB7185' }}>{error || 'Not found.'}</p></CmsShell>

  return (
    <CmsShell title={`Edit: ${page.title || slug}`}>
      <button onClick={() => router.push('/cms/pages')} className="cms-btn-ghost" style={{ marginBottom: 24 }}><ArrowLeft size={16} /> All pages</button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
        {CONTENT_FIELDS[slug] && (
          <div className="cms-card">
            <h2 className="cms-card-title">Public Page Copy</h2>
            <p className="cms-card-copy">This content appears on the redesigned public <strong>/{slug === 'home' ? '' : slug}</strong> page after publishing.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {CONTENT_FIELDS[slug].map((field) => (
                <div key={field.key}>
                  <label htmlFor={`page-content-${field.key}`} className="cms-label">{field.label}</label>
                  {field.multiline ? (
                    <textarea id={`page-content-${field.key}`} className="cms-textarea" rows={3} value={contentValue(field.key)} onChange={(e) => setContent(field.key, e.target.value)} />
                  ) : (
                    <input id={`page-content-${field.key}`} className="cms-input" value={contentValue(field.key)} onChange={(e) => setContent(field.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="cms-card">
          <h2 className="cms-card-title">SEO &amp; Publishing</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label htmlFor="page-title" className="cms-label">Page title</label><input id="page-title" className="cms-input" value={page.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div>
              <label htmlFor="page-status" className="cms-label">Status</label>
              <select id="page-status" className="cms-select" value={page.status} onChange={(e) => set({ status: e.target.value as CmsPageRow['status'] })}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
            <div><label htmlFor="page-meta-title" className="cms-label">Meta title</label><input id="page-meta-title" className="cms-input" value={page.metaTitle || ''} onChange={(e) => set({ metaTitle: e.target.value })} maxLength={70} />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>{(page.metaTitle || '').length}/70 — ideal under 60</p></div>
            <div><label htmlFor="page-meta-description" className="cms-label">Meta description</label><textarea id="page-meta-description" className="cms-textarea" rows={3} value={page.metaDescription || ''} onChange={(e) => set({ metaDescription: e.target.value })} maxLength={170} />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>{(page.metaDescription || '').length}/170 — ideal 150-160</p></div>
            <div><label htmlFor="page-keywords" className="cms-label">Keywords (comma separated)</label><input id="page-keywords" className="cms-input" value={(page.keywords || []).join(', ')} onChange={(e) => set({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></div>
            <div><label htmlFor="page-og-image" className="cms-label">OG image URL</label><input id="page-og-image" className="cms-input" value={page.ogImage || ''} onChange={(e) => set({ ogImage: e.target.value })} placeholder="/uploads/cms-media/..." /></div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="cms-btn" onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={18} className="cms-spin" /> Saving…</> : 'Save changes'}
          </button>
          {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34D399', fontSize: 14, fontWeight: 600 }}><Check size={16} /> Saved</span>}
          {error && <span style={{ color: '#FB7185', fontSize: 14 }}>{error}</span>}
        </div>
      </div>
    </CmsShell>
  )
}
