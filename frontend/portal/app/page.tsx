import Link from 'next/link'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
]

const FEATURES = [
  {
    icon: '🔒',
    title: 'Proctor-Controlled Sessions',
    desc: 'Every session begins only after a certified proctor completes a formal pre-exam checklist. No shortcuts, no exceptions.',
    accent: '#3B82F6',
  },
  {
    icon: '🤖',
    title: 'AI Proctoring & Facial Recognition',
    desc: 'Real-time face detection, gaze tracking, tab-switch alerts, and full session screen recording — all reviewed by a human proctor.',
    accent: '#6D28D9',
  },
  {
    icon: '📋',
    title: 'Two-Phase Exam Engine',
    desc: '30-minute MCQ screening always precedes a 60-minute practical task. The sequence is enforced by the platform — no skipping.',
    accent: '#059669',
  },
  {
    icon: '🔀',
    title: '500-Question Shuffle',
    desc: 'Each assessment type holds 500 questions. Every candidate receives 25 randomly shuffled — no two papers are ever alike.',
    accent: '#D97706',
  },
  {
    icon: '📊',
    title: 'Full Answer Breakdown Reports',
    desc: 'Reports show every question asked, the answer given, and whether it was correct — not just a final score.',
    accent: '#3B82F6',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant & Isolated',
    desc: 'Each company sees only their own candidates, sessions, and reports. Strict tenant isolation is enforced at every layer.',
    accent: '#E11D48',
  },
]

const STATS = [
  { value: '500+', label: 'Questions per Assessment', sub: 'Fisher-Yates shuffled' },
  { value: '25', label: 'Questions per Candidate', sub: 'Unique every time' },
  { value: '7-Day', label: 'Recording Retention', sub: 'Auto-purged after' },
  { value: '100%', label: 'Proctor-Reviewed', sub: 'No auto-publish ever' },
]

const PROCESS = [
  { step: '01', title: 'HR Schedules', desc: 'HR uploads candidate list and selects assessment type. Magic link sent automatically.' },
  { step: '02', title: 'Proctor Checks In', desc: 'Certified proctor completes pre-exam checklist — ID verification, camera check, consent.' },
  { step: '03', title: 'MCQ Assessment', desc: 'Candidate answers 25 shuffled questions in 30 minutes. One question at a time, server-side.' },
  { step: '04', title: 'Practical Task', desc: 'Proctor assigns role-specific task. Candidate has 60 minutes to complete and submit.' },
  { step: '05', title: 'AI Report Draft', desc: 'AI generates full report with scores, answer breakdown, integrity score, and recommendation.' },
  { step: '06', title: 'Proctor Reviews & Publishes', desc: 'Proctor reviews AI draft, adds narrative, and publishes. HR receives the final report.' },
]

const INDUSTRIES = [
  { name: 'Engineering & Construction', roles: 'AutoCAD, BIM, MEP, Structural, Civil' },
  { name: 'Information Technology', roles: 'Python, JavaScript, Network, Cybersecurity' },
  { name: 'Finance & Accounting', roles: 'Accountant, Financial Analyst, Auditor' },
  { name: 'Human Resources', roles: 'HR Generalist, Talent Acquisition, L&D' },
  { name: 'Operations & Management', roles: 'Project Manager, Operations, Supply Chain' },
  { name: 'Design & Creative', roles: 'UI/UX, Graphic Design, Brand, 3D Visualizer' },
  { name: 'Data & Analytics', roles: 'Data Analyst, BI Analyst, Power BI, SQL' },
  { name: 'Custom Roles', roles: 'Any job role built to your specification' },
]

const TRUST = [
  { icon: '🛡️', title: 'Zero Auto-Publish', desc: 'Every report is reviewed and manually published by a certified proctor.' },
  { icon: '🔐', title: 'Tenant Isolation', desc: 'Your data is never visible to other companies. Enforced at database level.' },
  { icon: '📹', title: 'Full Session Recording', desc: 'Screen + webcam recorded for every session. Available to HR for 7 days.' },
  { icon: '✅', title: 'Verified Results', desc: 'QR-verified reports. Every published report links to a verification page.' },
]

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#040814', fontFamily: 'var(--font-ui)', overflowX: 'hidden' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="web-nav">
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#fff' }}>A</div>
          <span style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>assessexpert</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`web-nav-link ${l.href === '/' ? 'active' : ''}`}>{l.label}</Link>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/login" className="web-btn-outline">Portal Login</Link>
          <Link href="/contact" className="web-btn-primary">Request Demo</Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '140px 80px 120px', textAlign: 'center', overflow: 'hidden' }} className="web-grid-bg">
        {/* Glow orbs */}
        <div className="web-glow-orb" style={{ width: '600px', height: '600px', background: 'rgba(29,78,216,0.15)', top: '-200px', left: '50%', transform: 'translateX(-50%)' }} />
        <div className="web-glow-orb" style={{ width: '300px', height: '300px', background: 'rgba(59,130,246,0.1)', top: '100px', left: '10%' }} />
        <div className="web-glow-orb" style={{ width: '300px', height: '300px', background: 'rgba(109,40,217,0.08)', top: '100px', right: '10%' }} />

        <div style={{ position: 'relative', maxWidth: '900px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '28px' }}>B2B Pre-Employment Assessment Platform</div>

          <h1 style={{ fontSize: '68px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 28px', lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            Hire with Confidence.<br />
            <span style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 50%, #818CF8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Assess with Precision.
            </span>
          </h1>

          <p style={{ fontSize: '19px', color: '#94A3B8', maxWidth: '660px', margin: '0 auto 48px', lineHeight: 1.75 }}>
            assessexpert delivers AI-proctored, proctor-controlled technical assessments — producing verified, human-reviewed reports that give your hiring team the truth about every candidate.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '64px' }}>
            <Link href="/contact" className="web-btn-primary" style={{ padding: '14px 36px', fontSize: '16px' }}>Request a Demo →</Link>
            <Link href="/services" className="web-btn-outline" style={{ padding: '14px 36px', fontSize: '16px' }}>Explore Services</Link>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {['AI-Proctored', 'Human-Reviewed Reports', 'Multi-Tenant Isolated', 'No Auto-Publish'].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B' }}>
                <span style={{ color: '#3B82F6' }}>✓</span> {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(59,130,246,0.1)', borderBottom: '1px solid rgba(59,130,246,0.1)', padding: '56px 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px' }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div className="web-stat-value">{s.value}</div>
              <p style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: '600', color: '#E2E8F0' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section style={{ padding: '120px 80px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '72px' }}>
          <div className="web-label" style={{ marginBottom: '16px' }}>Platform Capabilities</div>
          <h2 style={{ fontSize: '44px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 16px', letterSpacing: '-0.02em' }}>Why assessexpert?</h2>
          <p style={{ fontSize: '17px', color: '#64748B', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
            Built for companies that need verified, structured evidence — not gut feel — before every hire.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className="web-card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, ${f.accent}, transparent)` }} />
              <div style={{ width: '48px', height: '48px', background: `${f.accent}18`, border: `1px solid ${f.accent}30`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '20px' }}>
                {f.icon}
              </div>
              <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: '700', color: '#F1F5F9', letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: 1.75 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '120px 80px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '72px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>The Assessment Lifecycle</div>
            <h2 style={{ fontSize: '44px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 16px', letterSpacing: '-0.02em' }}>How It Works</h2>
            <p style={{ fontSize: '17px', color: '#64748B', maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
              Every assessment follows a precise, repeatable 6-step protocol — from scheduling to published report.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', background: 'rgba(59,130,246,0.08)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(59,130,246,0.12)' }}>
            {PROCESS.map((p, i) => (
              <div key={p.step} style={{ padding: '40px 36px', background: '#040814', position: 'relative', borderRight: i % 3 !== 2 ? '1px solid rgba(59,130,246,0.08)' : 'none', borderBottom: i < 3 ? '1px solid rgba(59,130,246,0.08)' : 'none' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#3B82F6', letterSpacing: '0.1em', marginBottom: '16px' }}>STEP {p.step}</div>
                <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: '700', color: '#F1F5F9' }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748B', lineHeight: 1.7 }}>{p.desc}</p>
                <div style={{ position: 'absolute', top: '36px', right: '36px', width: '32px', height: '32px', background: 'rgba(59,130,246,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#3B82F6' }}>{p.step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ──────────────────────────────────────────────────── */}
      <section style={{ padding: '120px 80px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
          <div>
            <div className="web-label" style={{ marginBottom: '16px' }}>Industry Coverage</div>
            <h2 style={{ fontSize: '44px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Any Industry.<br />Any Job Role.
            </h2>
            <div className="web-divider" />
            <p style={{ fontSize: '16px', color: '#64748B', lineHeight: 1.8, marginBottom: '32px' }}>
              assessexpert is not limited to one sector. Our Exam Setup team builds and maintains question banks and practical tasks for any job role — from AutoCAD Draftsman to Python Developer to HR Generalist.
            </p>
            <Link href="/services" className="web-btn-primary" style={{ padding: '12px 28px', fontSize: '14px' }}>View All Assessment Types →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {INDUSTRIES.map(ind => (
              <div key={ind.name} style={{ padding: '20px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', transition: 'all 200ms' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: '#E2E8F0' }}>{ind.name}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{ind.roles}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ───────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(180deg, rgba(29,78,216,0.06) 0%, rgba(4,8,20,0) 100%)', borderTop: '1px solid rgba(59,130,246,0.1)', padding: '100px 80px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div className="web-label" style={{ marginBottom: '16px' }}>Built for Trust</div>
            <h2 style={{ fontSize: '40px', fontWeight: '800', color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em' }}>
              Every Result. Verified.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            {TRUST.map(t => (
              <div key={t.title} style={{ textAlign: 'center', padding: '36px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px' }}>
                <div style={{ fontSize: '36px', marginBottom: '16px' }}>{t.icon}</div>
                <h4 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: '700', color: '#E2E8F0' }}>{t.title}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{ padding: '120px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="web-glow-orb" style={{ width: '500px', height: '500px', background: 'rgba(29,78,216,0.12)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
        <div style={{ position: 'relative', maxWidth: '700px', margin: '0 auto' }}>
          <div className="web-label" style={{ marginBottom: '24px' }}>Get Started</div>
          <h2 style={{ fontSize: '48px', fontWeight: '800', color: '#F1F5F9', margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Ready to transform<br />your hiring process?
          </h2>
          <p style={{ color: '#64748B', fontSize: '17px', marginBottom: '40px', lineHeight: 1.7 }}>
            No self-signup. No payment page. Every client relationship starts with a conversation with our team.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link href="/contact" className="web-btn-primary" style={{ padding: '16px 40px', fontSize: '16px' }}>Get in Touch →</Link>
            <Link href="/about" className="web-btn-outline" style={{ padding: '16px 40px', fontSize: '16px' }}>Learn About Us</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="web-footer">
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '60px', marginBottom: '60px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', color: '#fff' }}>A</div>
                <span style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: '700' }}>assessexpert</span>
              </div>
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.7, maxWidth: '280px', margin: '0 0 20px' }}>
                Global B2B SaaS pre-employment assessment platform. AI-proctored. Human-reviewed. Verified.
              </p>
              <p style={{ color: '#334155', fontSize: '13px', margin: 0 }}>Powered by Orbit Training · Dubai, UAE</p>
            </div>
            <div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Platform</p>
              {[['/', 'Home'], ['/services', 'Services'], ['/about', 'About Us'], ['/contact', 'Contact']].map(([href, label]) => (
                <Link key={href} href={href} style={{ display: 'block', color: '#475569', textDecoration: 'none', fontSize: '14px', marginBottom: '10px' }}>{label}</Link>
              ))}
            </div>
            <div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Portal</p>
              {[['/login', 'Sign In'], ['/exam', 'Candidate Exam']].map(([href, label]) => (
                <Link key={href} href={href} style={{ display: 'block', color: '#475569', textDecoration: 'none', fontSize: '14px', marginBottom: '10px' }}>{label}</Link>
              ))}
            </div>
            <div>
              <p style={{ margin: '0 0 16px', fontSize: '12px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contact</p>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '8px' }}>hello@assessexpert.ae</p>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '8px' }}>+971 50 000 0000</p>
              <p style={{ color: '#475569', fontSize: '14px' }}>Dubai, UAE</p>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>© 2026 assessexpert. All rights reserved.</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>assessexpert.ae · app.assessexpert.ae</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
