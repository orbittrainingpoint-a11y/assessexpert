'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { NAV_LINKS, SITE } from '@/lib/marketing-content'
import { siteGraph, jsonLdProps } from '@/lib/seo-schema'

function Logo({ size = 40 }: { size?: number }) {
  // Real AssessExpert wordmark (icon + text baked into PNG).
  // Height-driven; width scales via aspect-ratio.
  return (
    <img
      src="/brand/assessexpert-logo.png"
      alt={SITE.brand}
      height={size}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  )
}

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
    {/* Site-wide schema graph — Organization + LocalBusiness + WebSite.
        Emitted from the nav so every marketing page that includes
        <SiteNav /> automatically gets the entity graph without each
        page needing to remember to add it. Page-specific schema
        (BreadcrumbList, BlogPosting, FAQPage, Service) is added on
        the individual page. */}
    <script {...jsonLdProps(siteGraph())} />
    <nav className="web-nav" style={{ boxShadow: scrolled ? '0 18px 42px rgba(1,6,18,0.72)' : 'none', borderBottomColor: scrolled ? 'rgba(59,141,255,0.22)' : 'rgba(59,141,255,0.08)' }}>
      {/* Inner container caps + centers nav content so it lines up with
          the page sections (also max-width 1280, margin auto). */}
      <div className="web-nav-inner">
        <Link href="/" style={{ textDecoration: 'none' }} aria-label={`${SITE.brand} home`}><Logo /></Link>

        {/* Desktop links */}
        <div className="web-nav-links">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`web-nav-link ${isActive(l.href) ? 'active' : ''}`} aria-current={isActive(l.href) ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="web-nav-actions">
          <Link href="/login" className="web-btn-outline">Portal Login</Link>
          <Link href="/contact" className="web-btn-primary">Request Demo</Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="web-nav-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          style={{ background: 'none', border: 'none', color: 'var(--web-text)', cursor: 'pointer', padding: 8 }}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="web-nav-drawer">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={`web-nav-link ${isActive(l.href) ? 'active' : ''}`} style={{ fontSize: 16, padding: '12px 0' }}>
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="web-btn-outline" style={{ justifyContent: 'center', marginTop: 8 }}>Portal Login</Link>
          <Link href="/contact" onClick={() => setOpen(false)} className="web-btn-primary" style={{ justifyContent: 'center' }}>Request Demo</Link>
        </div>
      )}
    </nav>
    </>
  )
}
