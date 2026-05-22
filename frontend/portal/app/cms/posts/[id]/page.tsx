'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Check, ExternalLink } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsPostRow } from '@/lib/cms-admin-api'

type Draft = Partial<CmsPostRow>

export default function CmsPostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const router = useRouter()
  const [post, setPost] = useState<Draft>({ status: 'DRAFT', tags: [], keywords: [], body: '' })
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew) return
    cmsApi.getPost(id).then(setPost).catch(() => setError('Could not load this post.')).finally(() => setLoading(false))
  }, [id, isNew])

  const set = (patch: Draft) => setPost((p) => ({ ...p, ...patch }))

  const save = async () => {
    if (!post.title?.trim()) { setError('Title is required.'); return }
    setSaving(true); setError(''); setSaved(false)
    try {
      const payload: Draft = {
        title: post.title, slug: post.slug, excerpt: post.excerpt, body: post.body,
        coverImage: post.coverImage, tags: post.tags, status: post.status,
        authorName: post.authorName, metaTitle: post.metaTitle,
        metaDescription: post.metaDescription, keywords: post.keywords,
      }
      if (isNew) {
        const created = await cmsApi.createPost(payload)
        router.replace(`/cms/posts/${created.id}`)
      } else {
        const updated = await cmsApi.updatePost(id, payload)
        setPost(updated)
        setSaved(true); setTimeout(() => setSaved(false), 2500)
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <CmsShell><Loader2 size={24} className="cms-spin" color="#60A5FA" /></CmsShell>

  return (
    <CmsShell title={isNew ? 'New Post' : `Edit: ${post.title || ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => router.push('/cms/posts')} className="cms-btn-ghost"><ArrowLeft size={16} /> All posts</button>
        {!isNew && post.status === 'PUBLISHED' && post.slug && (
          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="cms-btn-ghost"><ExternalLink size={15} /> View live</a>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
        <div className="cms-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label className="cms-label">Title *</label><input className="cms-input" value={post.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="A clear, descriptive headline" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div><label className="cms-label">Slug {isNew && <span style={{ textTransform: 'none', color: '#475569' }}>(auto from title if blank)</span>}</label><input className="cms-input" value={post.slug || ''} onChange={(e) => set({ slug: e.target.value })} placeholder="my-post" /></div>
            <div>
              <label className="cms-label">Status</label>
              <select className="cms-select" value={post.status} onChange={(e) => set({ status: e.target.value as CmsPostRow['status'] })}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>
          <div><label className="cms-label">Author</label><input className="cms-input" value={post.authorName || ''} onChange={(e) => set({ authorName: e.target.value })} placeholder="AssessExpert Team" /></div>
          <div><label className="cms-label">Excerpt</label><textarea className="cms-textarea" rows={2} value={post.excerpt || ''} onChange={(e) => set({ excerpt: e.target.value })} placeholder="One- or two-sentence summary shown on the blog list." /></div>
          <div><label className="cms-label">Cover image URL</label><input className="cms-input" value={post.coverImage || ''} onChange={(e) => set({ coverImage: e.target.value })} placeholder="/uploads/cms-media/..." /></div>
          <div><label className="cms-label">Tags (comma separated)</label><input className="cms-input" value={(post.tags || []).join(', ')} onChange={(e) => set({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Hiring, Proctoring" /></div>
        </div>

        <div className="cms-card">
          <label className="cms-label">Body (HTML)</label>
          <textarea className="cms-textarea" rows={14} value={post.body || ''} onChange={(e) => set({ body: e.target.value })} placeholder="<p>Write your article in HTML. &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;blockquote&gt;, &lt;a&gt;, &lt;code&gt; are supported and sanitised on render.</p>" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }} />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#475569' }}>Script tags and inline event handlers are stripped server-side and sanitised again on render.</p>
        </div>

        <div className="cms-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>SEO</h2>
          <div><label className="cms-label">Meta title</label><input className="cms-input" value={post.metaTitle || ''} onChange={(e) => set({ metaTitle: e.target.value })} placeholder="Defaults to post title" /></div>
          <div><label className="cms-label">Meta description</label><textarea className="cms-textarea" rows={2} value={post.metaDescription || ''} onChange={(e) => set({ metaDescription: e.target.value })} placeholder="Defaults to excerpt" /></div>
          <div><label className="cms-label">Keywords (comma separated)</label><input className="cms-input" value={(post.keywords || []).join(', ')} onChange={(e) => set({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="cms-btn" onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={18} className="cms-spin" /> Saving…</> : isNew ? 'Create post' : 'Save changes'}
          </button>
          {saved && <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#34D399', fontSize: 14, fontWeight: 600 }}><Check size={16} /> Saved</span>}
          {error && <span style={{ color: '#FB7185', fontSize: 14 }}>{error}</span>}
        </div>
      </div>
    </CmsShell>
  )
}
