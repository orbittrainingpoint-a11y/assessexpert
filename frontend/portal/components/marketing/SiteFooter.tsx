import Link from 'next/link'
import { Mail, Phone, MapPin } from 'lucide-react'
import { SITE } from '@/lib/marketing-content'

export function SiteFooter() {
  return (
    <footer className="web-footer">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="web-footer-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>A</span>
              <span style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 700 }}>{SITE.brand}</span>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.7, maxWidth: '280px', margin: '0 0 20px' }}>
              Global B2B SaaS pre-employment assessment platform. AI-proctored. Human-reviewed. Verified.
            </p>
            <p style={{ color: '#334155', fontSize: '13px', margin: 0 }}>Powered by {SITE.org} · {SITE.location}</p>
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
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 8 }}><Mail size={15} /> {SITE.email}</p>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: 8 }}><Phone size={15} /> {SITE.phone}</p>
            <p style={{ color: '#64748B', fontSize: '14px', display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={15} /> {SITE.location}</p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>© 2026 {SITE.brand}. All rights reserved.</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>assessexpert.ae · app.assessexpert.ae</p>
        </div>
      </div>
    </footer>
  )
}
