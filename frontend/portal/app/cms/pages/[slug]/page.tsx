'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsPageRow } from '@/lib/cms-admin-api'

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
        {slug === 'home' && (
          <div className="cms-card">
            <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Hero Content</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label className="cms-label">Hero badge</label><input className="cms-input" value={page.content?.heroBadge || ''} onChange={(e) => setContent('heroBadge', e.target.value)} /></div>
              <div><label className="cms-label">Hero title (line 1)</label><input className="cms-input" value={page.content?.heroTitle || ''} onChange={(e) => setContent('heroTitle', e.target.value)} /></div>
              <div><label className="cms-label">Hero highlight (gradient line)</label><input className="cms-input" value={page.content?.heroHighlight || ''} onChange={(e) => setContent('heroHighlight', e.target.value)} /></div>
              <div><label className="cms-label">Hero subtitle</label><textarea className="cms-textarea" rows={3} value={page.content?.heroSubtitle || ''} onChange={(e) => setContent('heroSubtitle', e.target.value)} /></div>
            </div>
          </div>
        )}

        <div className="cms-card">
          <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>SEO &amp; Status</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><label className="cms-label">Page title</label><input className="cms-input" value={page.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div>
              <label className="cms-label">Status</label>
              <select className="cms-select" value={page.status} onChange={(e) => set({ status: e.target.value as CmsPageRow['status'] })}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
            <div><label className="cms-label">Meta title</label><input className="cms-input" value={page.metaTitle || ''} onChange={(e) => set({ metaTitle: e.target.value })} maxLength={70} />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>{(page.metaTitle || '').length}/70 — ideal under 60</p></div>
            <div><label className="cms-label">Meta description</label><textarea className="cms-textarea" rows={3} value={page.metaDescription || ''} onChange={(e) => set({ metaDescription: e.target.value })} maxLength={170} />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>{(page.metaDescription || '').length}/170 — ideal 150-160</p></div>
            <div><label className="cms-label">Keywords (comma separated)</label><input className="cms-input" value={(page.keywords || []).join(', ')} onChange={(e) => set({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></div>
            <div><label className="cms-label">OG image URL</label><input className="cms-input" value={page.ogImage || ''} onChange={(e) => set({ ogImage: e.target.value })} placeholder="/uploads/cms-media/..." /></div>
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
