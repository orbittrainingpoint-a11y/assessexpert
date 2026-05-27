'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, cmsErrorMessage, type CmsPostRow } from '@/lib/cms-admin-api'

export default function CmsPostsList() {
  const router = useRouter()
  const [posts, setPosts] = useState<CmsPostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () => cmsApi.listPosts().then(setPosts).catch(() => setError('Could not load blog posts.')).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setBusy(id)
    setError('')
    try { await cmsApi.deletePost(id); setPosts((ps) => ps.filter((p) => p.id !== id)) }
    catch (err: unknown) { setError(cmsErrorMessage(err, 'Could not delete this post.')) }
    finally { setBusy(null) }
  }

  return (
    <CmsShell title="Blog Posts">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-16px 0 28px' }}>
        <p className="cms-copy" style={{ margin: 0 }}>Write and publish articles. Published posts appear on /blog and in the sitemap.</p>
        <button className="cms-btn" onClick={() => router.push('/cms/posts/new')}><Plus size={18} /> New post</button>
      </div>

      {error && <div className="cms-alert">{error}</div>}
      {loading ? <Loader2 size={24} className="cms-spin" color="#60A5FA" /> : posts.length === 0 ? (
        <div className="cms-card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: '#94A3B8', margin: '0 0 16px' }}>No posts yet.</p>
          <button className="cms-btn" onClick={() => router.push('/cms/posts/new')} style={{ margin: '0 auto' }}><Plus size={18} /> Create your first post</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map((p) => (
            <div key={p.id} className="cms-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--web-text)' }}>{p.title}</span>
                  <span className={`cms-status ${p.status === 'PUBLISHED' ? 'published' : 'draft'}`}>{p.status}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--web-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/blog/{p.slug}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={`/cms/posts/${p.id}`} className="cms-btn-ghost" style={{ padding: '9px 14px' }}><Pencil size={15} /> Edit</Link>
                <button onClick={() => remove(p.id, p.title)} disabled={busy === p.id} className="cms-btn-ghost" style={{ padding: '9px 14px', color: '#FB7185', borderColor: 'rgba(225,29,72,0.3)' }}>
                  {busy === p.id ? <Loader2 size={15} className="cms-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </CmsShell>
  )
}
