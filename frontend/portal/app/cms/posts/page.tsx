'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsPostRow } from '@/lib/cms-admin-api'

export default function CmsPostsList() {
  const router = useRouter()
  const [posts, setPosts] = useState<CmsPostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => cmsApi.listPosts().then(setPosts).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setBusy(id)
    try { await cmsApi.deletePost(id); setPosts((ps) => ps.filter((p) => p.id !== id)) }
    finally { setBusy(null) }
  }

  return (
    <CmsShell title="Blog Posts">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-16px 0 28px' }}>
        <p style={{ color: '#94A3B8', margin: 0, fontSize: 15 }}>Write and publish articles. Published posts appear on /blog and in the sitemap.</p>
        <button className="cms-btn" onClick={() => router.push('/cms/posts/new')}><Plus size={18} /> New post</button>
      </div>

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
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>{p.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 9999, color: p.status === 'PUBLISHED' ? '#34D399' : '#FBBF24', background: p.status === 'PUBLISHED' ? 'rgba(5,150,105,0.15)' : 'rgba(217,119,6,0.15)' }}>{p.status}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/blog/{p.slug}</p>
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
