'use client'
import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, FileStack, Newspaper, ImageIcon, LogOut, ExternalLink, Loader2, Sparkles } from 'lucide-react'
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
      <div className="cms-state">
        <Loader2 size={28} className="cms-spin" />
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="cms-state">
        <h1 style={{ fontSize: 22, margin: 0 }}>No CMS access</h1>
        <p style={{ color: '#94A3B8', margin: 0 }}>Your account doesn&rsquo;t have a CMS role. Contact a platform admin.</p>
        <button onClick={logout} className="web-btn-outline" style={{ cursor: 'pointer' }}>Sign out</button>
      </div>
    )
  }

  const isActive = (item: typeof NAV[number]) => item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <div className="cms-root">
      <aside className="cms-sidebar">
        <div className="cms-brand">
          <span className="cms-brand-mark">A</span>
          <div>
            <div className="cms-brand-name">assessexpert</div>
            <div className="cms-brand-sub"><Sparkles size={10} /> Content studio</div>
          </div>
        </div>

        <nav className="cms-nav">
          {NAV.map((item) => {
            const active = isActive(item)
            return (
              <Link key={item.href} href={item.href} className={`cms-nav-item ${active ? 'active' : ''}`}>
                <item.Icon size={18} /> {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="cms-sidebar-foot">
          <Link href="/" target="_blank" rel="noopener noreferrer" className="cms-nav-item">
            <ExternalLink size={18} /> View site
          </Link>
          <div className="cms-user">
            <p className="cms-user-email">{user?.email}</p>
            <p className="cms-user-role">{user?.role}</p>
            <button onClick={logout} className="cms-logout">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="cms-main">
        {title && <h1 className="cms-title">{title}</h1>}
        {children}
      </main>
    </div>
  )
}
