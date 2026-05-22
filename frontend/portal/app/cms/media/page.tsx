'use client'
import { useEffect, useRef, useState } from 'react'
import { UploadCloud, Loader2, Trash2, Copy, Check } from 'lucide-react'
import { CmsShell } from '@/components/cms/CmsShell'
import { cmsApi, type CmsMediaRow } from '@/lib/cms-admin-api'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')

function fullUrl(u: string) {
  return u.startsWith('http') ? u : `${API_ORIGIN}${u}`
}

export default function CmsMediaLibrary() {
  const [media, setMedia] = useState<CmsMediaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cmsApi.listMedia().then(setMedia).finally(() => setLoading(false)) }, [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const row = await cmsApi.uploadMedia(file)
      setMedia((m) => [row, ...m])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Upload failed (images only: JPG, PNG, GIF, WEBP).')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this image? Pages referencing it will lose it.')) return
    await cmsApi.deleteMedia(id)
    setMedia((m) => m.filter((x) => x.id !== id))
  }

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url)
    setCopied(url); setTimeout(() => setCopied(null), 1800)
  }

  return (
    <CmsShell title="Media Library">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-16px 0 28px', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ color: '#94A3B8', margin: 0, fontSize: 15 }}>Upload images for page heroes and post covers. Copy a URL to paste into an editor field.</p>
        <button className="cms-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <><Loader2 size={18} className="cms-spin" /> Uploading…</> : <><UploadCloud size={18} /> Upload image</>}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onFile} style={{ display: 'none' }} />
      </div>

      {error && <p style={{ color: '#FB7185', fontSize: 14, marginBottom: 16 }}>{error}</p>}

      {loading ? <Loader2 size={24} className="cms-spin" color="#60A5FA" /> : media.length === 0 ? (
        <div className="cms-card" style={{ textAlign: 'center', padding: 48, color: '#64748B' }}>No images yet. Upload your first one above.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {media.map((m) => (
            <div key={m.id} className="cms-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fullUrl(m.url)} alt={m.alt || m.filename} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: '#0B1220' }} />
              <div style={{ padding: 12 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => copy(m.url)} className="cms-btn-ghost" style={{ padding: '7px 10px', fontSize: 12, flex: 1, justifyContent: 'center' }}>
                    {copied === m.url ? <><Check size={14} /> Copied</> : <><Copy size={14} /> URL</>}
                  </button>
                  <button onClick={() => remove(m.id)} className="cms-btn-ghost" style={{ padding: '7px 10px', color: '#FB7185', borderColor: 'rgba(225,29,72,0.3)' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CmsShell>
  )
}
