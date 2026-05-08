'use client'
import { useState } from 'react'
import Link from 'next/link'
import { salesApi } from '@/lib/api'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
]

const ASSESSMENT_TYPE_OPTIONS = [
  'AutoCAD / BIM / CAD',
  'Python / JavaScript Developer',
  'Network / IT Engineer',
  'HR Generalist',
  'Accountant / Finance',
  'Project Manager / Planning',
  'Data Analyst / BI',
  'Design / UI-UX',
  'Custom Role',
]

const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+']

const CONTACT_INFO = [
  { icon: '📧', label: 'Email', value: 'hello@assessexpert.ae', sub: 'We respond within 1 business day' },
  { icon: '📞', label: 'Phone / WhatsApp', value: '+971 50 000 0000', sub: 'Sun – Thu · 9AM – 6PM GST' },
  { icon: '📍', label: 'Location', value: 'Dubai, United Arab Emirates', sub: 'Orbit Training HQ' },
  { icon: '🌐', label: 'Website', value: 'assessexpert.ae', sub: 'app.assessexpert.ae for portal' },
]

const PROCESS_STEPS = [
  { n: '1', title: 'Submit Form', desc: 'Fill in your details and assessment needs' },
  { n: '2', title: 'Sales Contact', desc: 'Our team reaches out within 1 business day' },
  { n: '3', title: 'Live Demo', desc: 'We walk you through the full platform' },
  { n: '4', title: 'Agreement', desc: 'Commercial agreement — no payment page' },
  { n: '5', title: 'Onboarded', desc: 'Your company is live on assessexpert' },
]

export default function ContactPage() {
  const [form, setForm] = useState({
    companyName: '', fullName: '', role: '', email: '', phone: '',
    companySize: '', message: '', assessmentTypes: [] as string[],
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggle = (type: string) => {
    setForm(f => ({
      ...f,
      assessmentTypes: f.assessmentTypes.includes(type)
        ? f.assessmentTypes.filter(t => t !== type)
        : [...f.assessmentTypes, type],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await salesApi.createLead(form)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please email us directly at hello@assessexpert.ae')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', overflowX: 'hidden' }}>

      {/* NAV */}
      <nav className="web-nav">
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#fff' }}>A</div>
          <span style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>assessexpert</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`web-nav-link ${l.href === '/contact' ? 'active' : ''}`}>{l.label}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/login" className="web-btn-outline">Portal Login</Link>
          <Link href="/contact" className="web-btn-primary">Request Demo</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', padding: '100px 80px 80px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        <div className="web-glow-orb" style={{ width: '400px', height: '400px', background: 'rgba(29,78,216,0.12)', top: '-100px', left: '50%', transform: 'translateX(-50%)' }} />
        <div style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '20px' }}>Start the Conversation</div>
          <h1 style={{ fontSize: '60px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 20px', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            Let's <span style={{ background: 'linear-gradient(135deg, #60A5FA, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Talk</span>
          </h1>
          <p style={{ fontSize: '17px', color: '#64748B', lineHeight: 1.75, margin: 0 }}>
            assessexpert is a sales-led platform. There's no self-signup or checkout. Every client relationship starts with a conversation with our team.
          </p>
        </div>
      </section>

      {/* PROCESS STEPS */}
      <section style={{ padding: '0 80px 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: '16px', overflow: 'hidden' }}>
          {PROCESS_STEPS.map((s, i) => (
            <div key={s.n} style={{ padding: '28px 24px', textAlign: 'center', borderRight: i < 4 ? '1px solid rgba(59,130,246,0.1)' : 'none', background: '#040814' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#60A5FA', margin: '0 auto 12px' }}>{s.n}</div>
              <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#E2E8F0' }}>{s.title}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section style={{ padding: '0 80px 100px', maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '60px', alignItems: 'start' }}>

        {/* LEFT — Contact Info */}
        <div>
          <div className="web-label" style={{ marginBottom: '20px' }}>Contact Details</div>
          <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 12px', letterSpacing: '-0.02em' }}>Get in Touch</h2>
          <div className="web-divider" />
          <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.8, marginBottom: '40px' }}>
            Our sales team is ready to walk you through the platform, answer your questions, and build a custom assessment plan for your hiring needs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '48px' }}>
            {CONTACT_INFO.map(c => (
              <div key={c.label} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>{c.label}</p>
                  <p style={{ margin: '0 0 2px', fontSize: '15px', color: '#E2E8F0', fontWeight: '600' }}>{c.value}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{c.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '24px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '14px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#60A5FA' }}>How it works</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: 1.7 }}>
              Submit this form → Sales team contacts you within 1 business day → Live demo scheduled → Commercial agreement → Company onboarded on assessexpert.
            </p>
          </div>
        </div>

        {/* RIGHT — Form */}
        <div style={{ padding: '48px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ width: '72px', height: '72px', background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 24px' }}>✅</div>
              <h3 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: '800', color: '#F1F5F9', letterSpacing: '-0.02em' }}>Message Received!</h3>
              <p style={{ color: '#64748B', fontSize: '15px', lineHeight: 1.7, marginBottom: '8px' }}>
                Our sales team will contact you at
              </p>
              <p style={{ color: '#60A5FA', fontSize: '16px', fontWeight: '600', marginBottom: '32px' }}>{form.email}</p>
              <p style={{ color: '#475569', fontSize: '14px' }}>Expected response: within 1 business day</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '800', color: '#F1F5F9', letterSpacing: '-0.02em' }}>Request a Demo</h2>
                <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>All fields marked * are required</p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[
                    { key: 'companyName', label: 'Company Name *', placeholder: 'Acme Corp', required: true },
                    { key: 'fullName', label: 'Your Full Name *', placeholder: 'Jane Smith', required: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>{f.label}</label>
                      <input className="form-input" required={f.required} value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Your Role *</label>
                    <input className="form-input" required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="HR Manager" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Company Size</label>
                    <select className="form-input" value={form.companySize} onChange={e => setForm(f => ({ ...f, companySize: e.target.value }))} style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                      <option value="">Select size</option>
                      {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Work Email *</label>
                    <input className="form-input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Phone / WhatsApp</label>
                    <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+971 50 000 0000" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Assessment Types Interested In</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {ASSESSMENT_TYPE_OPTIONS.map(t => (
                      <button key={t} type="button" onClick={() => toggle(t)} style={{
                        padding: '7px 16px', borderRadius: '9999px', fontSize: '13px', cursor: 'pointer',
                        border: '1px solid', transition: 'all 150ms', fontWeight: '500',
                        background: form.assessmentTypes.includes(t) ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                        borderColor: form.assessmentTypes.includes(t) ? '#3B82F6' : 'rgba(255,255,255,0.08)',
                        color: form.assessmentTypes.includes(t) ? '#60A5FA' : '#64748B',
                      }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Message</label>
                  <textarea className="form-input" rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Tell us about your hiring needs, volume, timeline, or any specific requirements..." style={{ resize: 'vertical', background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }} />
                </div>

                {error && (
                  <div style={{ padding: '12px 16px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '8px', fontSize: '13px', color: '#E11D48' }}>{error}</div>
                )}

                <button className="web-btn-primary" type="submit" disabled={loading} style={{ padding: '16px', fontSize: '15px', width: '100%', justifyContent: 'center', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Sending...' : 'Send Request →'}
                </button>

                <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center' }}>
                  By submitting, you agree to be contacted by our sales team. No spam, ever.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="web-footer">
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px', paddingBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#fff' }}>A</div>
              <span style={{ color: '#F1F5F9', fontSize: '16px', fontWeight: '700' }}>assessexpert</span>
            </div>
            <div style={{ display: 'flex', gap: '28px' }}>
              {NAV_LINKS.map(l => (
                <Link key={l.href} href={l.href} style={{ color: '#475569', textDecoration: 'none', fontSize: '14px' }}>{l.label}</Link>
              ))}
              <Link href="/login" style={{ color: '#475569', textDecoration: 'none', fontSize: '14px' }}>Portal Login</Link>
            </div>
            <span style={{ color: '#334155', fontSize: '13px' }}>© 2026 assessexpert · Powered by Orbit Training · Dubai, UAE</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
