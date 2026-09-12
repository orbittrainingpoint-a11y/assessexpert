import Link from 'next/link'
import { Mail, Phone, MapPin } from 'lucide-react'
import { SITE } from '@/lib/marketing-content'

export function SiteFooter() {
  return (
    <footer className="web-footer">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="web-footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              {/* White wordmark for the dark footer ground (#030711). */}
              <img
                src="/brand/assessexpert-logo-white.png"
                alt={SITE.brand}
                height={36}
                style={{ height: 36, width: 'auto', display: 'block' }}
              />
            </div>
            <p style={{ color: 'var(--web-text-muted)', fontSize: '14px', lineHeight: 1.7, maxWidth: '280px', margin: '0 0 20px', fontFamily: 'var(--web-sans)' }}>
              Global B2B SaaS pre-employment assessment platform. AI-proctored. Human-reviewed. Verified.
            </p>
            <p style={{ color: 'var(--web-text-muted)', fontSize: '13px', margin: 0 }}>Powered by {SITE.org} · {SITE.location}</p>
          </div>
          <div>
            <p className="web-footer-head">Platform</p>
            {[['/', 'Home'], ['/services', 'Services'], ['/about', 'About Us'], ['/blog', 'Blog'], ['/contact', 'Contact']].map(([href, label]) => (
              <Link key={href} href={href} className="web-footer-link">{label}</Link>
            ))}
          </div>
          <div>
            <p className="web-footer-head">Portal</p>
            {[['/login', 'Sign In'], ['/exam', 'Candidate Exam']].map(([href, label]) => (
              <Link key={href} href={href} className="web-footer-link">{label}</Link>
            ))}
          </div>
          <div>
            <p className="web-footer-head">Contact</p>
            <p style={{ color: 'var(--web-text-secondary)', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={15} style={{ color: 'var(--web-gold)' }} />
              <a href={`mailto:${SITE.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>{SITE.email}</a>
            </p>
            <p style={{ color: 'var(--web-text-secondary)', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={15} style={{ color: 'var(--web-gold)' }} />
              <a href={`tel:${SITE.phoneE164}`} style={{ color: 'inherit', textDecoration: 'none' }}>{SITE.phone}</a>
            </p>
            <p style={{ color: 'var(--web-text-secondary)', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
              <MapPin size={15} style={{ color: 'var(--web-gold)', marginTop: 3, flexShrink: 0 }} />
              <span>{SITE.address}</span>
            </p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(59,141,255,0.14)', paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-muted)' }}>© 2026 {SITE.brand}. All rights reserved.</p>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--web-text-muted)' }}>{SITE.url.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>
    </footer>
  )
}
