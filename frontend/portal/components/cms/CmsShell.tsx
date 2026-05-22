'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, FileStack, Newspaper, ImageIcon, LogOut, ExternalLink, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { CMS_ROLES } from '@/lib/cms-admin-api'

const NAV = [
  { href: '/cms', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/cms/pages', label: 'Pages', Icon: FileStack },
  { href: '/cms/posts', label: 'Blog Posts', Icon: Newspaper },
  { href: '/cms/media', label: 'Media', Icon: ImageIcon },
]

export function CmsShell({ children, title }: { children: ReactNode; title?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [user, setUser] = useState<{ email: string; role: string } | null>(null)

  useEffect(() => {
    let active = true
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) { router.replace('/cms/login'); return }
    api.get('/auth/me')
      .then((r) => {
        if (!active) return
        if (CMS_ROLES.includes(r.data.role)) { setUser(r.data); setState('ok') }
        else setState('denied')
      })
      .catch(() => { if (active) router.replace('/cms/login') })
    return () => { active = false }
  }, [router])

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    router.replace('/cms/login')
  }

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#040814', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
        <Loader2 size={28} className="cms-spin" />
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div style={{ minHeight: '100vh', background: '#040814', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#F1F5F9', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>No CMS access</h1>
        <p style={{ color: '#94A3B8', margin: 0 }}>Your account doesn&rsquo;t have a CMS role. Contact a platform admin.</p>
        <button onClick={logout} className="web-btn-outline" style={{ cursor: 'pointer' }}>Sign out</button>
      </div>
    )
  }

  const isActive = (item: typeof NAV[number]) => item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', display: 'grid', gridTemplateColumns: '248px 1fr' }} className="cms-root">
      <aside className="cms-sidebar" style={{ background: '#020510', borderRight: '1px solid rgba(59,130,246,0.12)', padding: '24px 16px', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px' }}>
          <span style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff' }}>A</span>
          <div>
            <div style={{ color: '#F1F5F9', fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>assessexpert</div>
            <div style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>CMS</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map((item) => {
            const active = isActive(item)
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10,
                textDecoration: 'none', fontSize: 14, fontWeight: 500,
                color: active ? '#60A5FA' : '#94A3B8',
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(59,130,246,0.25)' : 'transparent'}`,
              }}>
                <item.Icon size={18} /> {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10, textDecoration: 'none', fontSize: 14, color: '#94A3B8' }}>
            <ExternalLink size={18} /> View site
          </a>
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#E2E8F0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: '#475569' }}>{user?.role}</p>
            <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#E11D48', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main style={{ padding: '40px 48px', maxWidth: 1100, width: '100%' }}>
        {title && <h1 style={{ color: '#F1F5F9', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 28px' }}>{title}</h1>}
        {children}
      </main>
    </div>
  )
}
