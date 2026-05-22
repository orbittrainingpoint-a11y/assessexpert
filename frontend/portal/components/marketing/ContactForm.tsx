'use client'
import { useState } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { salesApi } from '@/lib/api'

const ASSESSMENT_TYPE_OPTIONS = [
  'AutoCAD / BIM / CAD', 'Python / JavaScript Developer', 'Network / IT Engineer',
  'HR Generalist', 'Accountant / Finance', 'Project Manager / Planning',
  'Data Analyst / BI', 'Design / UI-UX', 'Custom Role',
]
const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+']

export function ContactForm() {
  const [form, setForm] = useState({
    companyName: '', fullName: '', role: '', email: '', phone: '',
    companySize: '', message: '', assessmentTypes: [] as string[],
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggle = (type: string) =>
    setForm((f) => ({
      ...f,
      assessmentTypes: f.assessmentTypes.includes(type)
        ? f.assessmentTypes.filter((t) => t !== type)
        : [...f.assessmentTypes, type],
    }))

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

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', color: '#64748B', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', minHeight: 44 }

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }} role="status" aria-live="polite">
        <div style={{ width: 72, height: 72, background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle2 size={36} color="#059669" />
        </div>
        <h3 style={{ margin: '0 0 12px', fontSize: '24px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em' }}>Message Received!</h3>
        <p style={{ color: '#64748B', fontSize: '15px', lineHeight: 1.7, marginBottom: '8px' }}>Our sales team will contact you at</p>
        <p style={{ color: '#60A5FA', fontSize: '16px', fontWeight: 600, marginBottom: '32px' }}>{form.email}</p>
        <p style={{ color: '#475569', fontSize: '14px' }}>Expected response: within 1 business day</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.02em' }}>Request a Demo</h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748B' }}>All fields marked * are required</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label htmlFor="companyName" style={labelStyle}>Company Name *</label>
            <input id="companyName" className="form-input" required autoComplete="organization" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Acme Corp" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="fullName" style={labelStyle}>Your Full Name *</label>
            <input id="fullName" className="form-input" required autoComplete="name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Jane Smith" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label htmlFor="role" style={labelStyle}>Your Role *</label>
            <input id="role" className="form-input" required autoComplete="organization-title" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="HR Manager" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="companySize" style={labelStyle}>Company Size</label>
            <select id="companySize" className="form-input" value={form.companySize} onChange={(e) => setForm((f) => ({ ...f, companySize: e.target.value }))} style={inputStyle}>
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div>
            <label htmlFor="email" style={labelStyle}>Work Email *</label>
            <input id="email" className="form-input" type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="phone" style={labelStyle}>Phone / WhatsApp</label>
            <input id="phone" className="form-input" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971 50 000 0000" style={inputStyle} />
          </div>
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ ...labelStyle, marginBottom: 12 }}>Assessment Types Interested In</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ASSESSMENT_TYPE_OPTIONS.map((t) => {
              const on = form.assessmentTypes.includes(t)
              return (
                <button key={t} type="button" onClick={() => toggle(t)} aria-pressed={on} style={{
                  padding: '8px 16px', borderRadius: '9999px', fontSize: '13px', cursor: 'pointer',
                  border: '1px solid', transition: 'all 150ms', fontWeight: 500, minHeight: 36,
                  background: on ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: on ? '#3B82F6' : 'rgba(255,255,255,0.08)',
                  color: on ? '#60A5FA' : '#64748B',
                }}>
                  {t}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="message" style={labelStyle}>Message</label>
          <textarea id="message" className="form-input" rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Tell us about your hiring needs, volume, timeline, or any specific requirements..." style={{ resize: 'vertical', ...inputStyle }} />
        </div>

        {error && (
          <div role="alert" style={{ padding: '12px 16px', background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.2)', borderRadius: '8px', fontSize: '13px', color: '#E11D48' }}>{error}</div>
        )}

        <button className="web-btn-primary" type="submit" disabled={loading} style={{ padding: '16px', fontSize: '15px', width: '100%', justifyContent: 'center', marginTop: '4px', opacity: loading ? 0.7 : 1, gap: 8 }}>
          {loading ? 'Sending...' : <>Send Request <ArrowRight size={18} /></>}
        </button>

        <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center' }}>
          By submitting, you agree to be contacted by our sales team. No spam, ever.
        </p>
      </form>
    </>
  )
}
