'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth.store'
import { authApi, brandingApi, notificationsApi } from '@/lib/api'
import { useSessionExpiryWarning } from '@/lib/useSessionExpiryWarning'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Users, Building2, Calendar, FileText,
  Settings, LogOut, Bell, ChevronRight, Shield, BookOpen,
  ClipboardList, Video, BarChart3, UserCheck, Briefcase
} from 'lucide-react'

const NAV_CONFIG: Record<string, { label: string; icon: any; href: string }[]> = {
  SUPER_ADMIN: [
    { label: 'Overview', icon: LayoutDashboard, href: '/admin' },
    { label: 'Companies', icon: Building2, href: '/admin/companies' },
    { label: 'Users', icon: Users, href: '/admin/users' },
    { label: 'Schedule', icon: Calendar, href: '/admin/schedule' },
    { label: 'Reports', icon: FileText, href: '/admin/reports' },
    { label: 'Assessment Types', icon: BookOpen, href: '/admin/assessments' },
    { label: 'Question Bank', icon: ClipboardList, href: '/admin/questions' },
    { label: 'Settings', icon: Settings, href: '/admin/settings' },
  ],
  MASTER_PROCTOR: [
    { label: 'Overview', icon: LayoutDashboard, href: '/master-proctor' },
    { label: 'Proctor Management', icon: UserCheck, href: '/master-proctor/proctors' },
    { label: 'All Sessions', icon: Video, href: '/master-proctor/sessions' },
    { label: 'Create & Manage Exams', icon: BookOpen, href: '/master-proctor/exams' },
    { label: 'Question Papers', icon: ClipboardList, href: '/master-proctor/questions' },
    { label: 'Practical Paper Sets', icon: ClipboardList, href: '/master-proctor/paper-sets' },
    { label: 'Report Review', icon: FileText, href: '/master-proctor/reports' },
    { label: 'Settings', icon: Settings, href: '/master-proctor/settings' },
  ],
  PROCTOR: [
    { label: 'Overview', icon: LayoutDashboard, href: '/proctor' },
    { label: 'All Sessions', icon: Calendar, href: '/proctor/sessions' },
    { label: "Today's Assessments", icon: Calendar, href: '/proctor/today' },
    { label: 'Live Session', icon: Video, href: '/proctor/session' },
    { label: 'Completed & Reports', icon: FileText, href: '/proctor/reports' },
    { label: 'Settings', icon: Settings, href: '/proctor/settings' },
  ],
  EXAM_SETUP_MASTER: [
    { label: 'Overview', icon: LayoutDashboard, href: '/exam-setup' },
    { label: 'Assessment Types', icon: BookOpen, href: '/exam-setup/assessments' },
    { label: 'MCQ Question Bank', icon: ClipboardList, href: '/exam-setup/questions' },
    { label: 'Practical Library', icon: Briefcase, href: '/exam-setup/practical' },
    { label: 'Review & Approval', icon: Shield, href: '/exam-setup/review' },
    { label: 'Exam Simulation', icon: Video, href: '/exam-setup/simulation' },
    { label: 'Settings', icon: Settings, href: '/exam-setup/settings' },
  ],
  HR_MANAGER: [
    { label: 'Overview', icon: LayoutDashboard, href: '/hr' },
    { label: 'Candidates', icon: Users, href: '/hr/candidates' },
    { label: 'Assessments', icon: FileText, href: '/hr/assessments' },
    { label: 'Quiz Reports', icon: ClipboardList, href: '/hr/quiz-reports' },
    { label: 'Interviews', icon: Video, href: '/hr/interviews' },
    { label: 'Top Performers', icon: BarChart3, href: '/hr/performers' },
    { label: 'Settings', icon: Settings, href: '/hr/settings' },
  ],
  ORG_ADMIN: [
    { label: 'Overview', icon: LayoutDashboard, href: '/hr' },
    { label: 'Candidates', icon: Users, href: '/hr/candidates' },
    { label: 'Assessments', icon: FileText, href: '/hr/assessments' },
    { label: 'Quiz Reports', icon: ClipboardList, href: '/hr/quiz-reports' },
    { label: 'Interviews', icon: Video, href: '/hr/interviews' },
    { label: 'Top Performers', icon: BarChart3, href: '/hr/performers' },
    { label: 'Settings', icon: Settings, href: '/hr/settings' },
  ],
  HIRING_MANAGER: [
    { label: 'Overview', icon: LayoutDashboard, href: '/hr' },
    { label: 'Reports', icon: FileText, href: '/hr/assessments' },
    { label: 'Quiz Reports', icon: ClipboardList, href: '/hr/quiz-reports' },
    { label: 'Interviews', icon: Video, href: '/hr/interviews' },
  ],
  SALES_AGENT: [
    { label: 'Overview', icon: LayoutDashboard, href: '/sales' },
    { label: 'Leads', icon: Users, href: '/sales/leads' },
    { label: 'My Companies', icon: Building2, href: '/sales/companies' },
  ],
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, clearAuth } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => { setHydrated(true) }, [])

  // Toast the user ~2 minutes before their access token expires with a
  // one-click "Extend now" button so they don't get silently kicked
  // to /login mid-session. (PORTAL_GAPS.md H8.)
  useSessionExpiryWarning()

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsApi.getUnreadCount().then(r => r.data),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  })

  // Per-org branding — pulls the org's logo + display name + brand color so
  // the sidebar shows the customer's brand instead of the platform default.
  // Super admin sees the assessexpert default (no orgId in their JWT).
  const { data: branding } = useQuery({
    queryKey: ['branding', user?.organizationId],
    queryFn: () => brandingApi.get(user!.organizationId!).then(r => r.data),
    enabled: isAuthenticated && !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (hydrated && !isAuthenticated) router.push('/login')
  }, [hydrated, isAuthenticated, router])

  if (!hydrated) return null
  if (!user) return null

  // Filter nav items by per-org feature flags. Super-admin nav doesn't
  // depend on an org (no organizationId in their JWT) so we leave it
  // alone. HR-role nav drops items their org doesn't have access to —
  // currently just the Quiz Reports entry.
  const quizEnabled = branding?.features?.quiz === true
  const rawNavItems = NAV_CONFIG[user.role] || NAV_CONFIG.HR_MANAGER
  const navItems = rawNavItems.filter(item => {
    if (item.href === '/hr/quiz-reports' && !quizEnabled) return false
    return true
  })

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px', minHeight: '100vh', background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, zIndex: 50,
      }}>
        {/* Logo — uses the org's uploaded logo + display name when available,
            falls back to the assessexpert default for super-admin or
            pre-branding orgs. */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
          {branding?.logoUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* White chip behind the logo so an uploaded white-on-white,
                  transparent, or opaque-coloured logo all read cleanly on
                  the dark sidebar. Mirrors how every B2B SaaS handles
                  customer-uploaded brand marks. */}
              <div style={{
                background: '#fff',
                padding: '4px 6px',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
              }}>
                <img
                  src={branding.logoUrl}
                  alt={branding.displayName || 'Organization logo'}
                  style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }}
                />
              </div>
              <h1 style={{
                color: branding?.brandColor || 'var(--cyan)',
                fontSize: '15px', fontWeight: '700', margin: 0,
              }}>
                {branding.displayName || 'assessexpert'}
              </h1>
            </div>
          ) : (
            <h1 style={{
              color: branding?.brandColor || 'var(--cyan)',
              fontSize: '18px', fontWeight: '700', margin: 0,
            }}>
              {branding?.displayName || 'assessexpert'}
            </h1>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '4px 0 0' }}>
            {user.role.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Nav */}
        <nav aria-label="Portal navigation" style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/admin' && item.href !== '/hr' && item.href !== '/proctor' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`} style={{ marginBottom: '2px' }}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User + actions */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '4px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)', fontSize: '13px', fontWeight: '600' }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.firstName} {user.lastName}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)' }}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: '240px', flex: 1, minHeight: '100vh' }}>
        {/* Top bar */}
        <header style={{
          height: '56px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 24px', position: 'sticky', top: 0, zIndex: 40,
        }}>
          <button onClick={() => {}} style={{ position: 'relative', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <Bell size={20} />
            {(unreadData?.count || 0) > 0 && (
              <span style={{
                position: 'absolute', top: '-6px', right: '-6px',
                background: 'var(--rose)', color: 'white', borderRadius: '50%',
                width: '16px', height: '16px', fontSize: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600',
              }}>
                {unreadData.count > 9 ? '9+' : unreadData.count}
              </span>
            )}
          </button>
        </header>

        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
