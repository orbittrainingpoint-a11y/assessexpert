'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orgsApi, usersApi, reportsApi } from '@/lib/api'
import { Plus, Search, Building2, X, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const BLANK = { name: '', slug: '', country: 'UAE', city: '', industry: '', size: '', website: '', primaryContactName: '', primaryContactEmail: '', primaryContactPhone: '', assessmentCredits: 100, accountTier: 'STANDARD' }

export default function AdminCompaniesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [viewOrg, setViewOrg] = useState<any>(null)
  const [viewTab, setViewTab] = useState<'overview' | 'users' | 'history' | 'notes'>('overview')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('HR_MANAGER')
  const [orgNote, setOrgNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['orgs', search],
    queryFn: () => orgsApi.getAll({ search, limit: 100 }).then(r => r.data),
  })

  const { data: orgDetail } = useQuery({
    queryKey: ['org-detail', viewOrg?.id],
    queryFn: () => orgsApi.getOne(viewOrg.id).then(r => r.data),
    enabled: !!viewOrg?.id,
  })

  const { data: orgUsers } = useQuery({
    queryKey: ['org-users', viewOrg?.id],
    queryFn: () => usersApi.getAll({ organizationId: viewOrg.id, limit: 50 }).then(r => r.data),
    enabled: !!viewOrg?.id && viewTab === 'users',
  })

  const { data: orgReports } = useQuery({
    queryKey: ['org-reports', viewOrg?.id],
    queryFn: () => reportsApi.getAll({ organizationId: viewOrg.id, limit: 50 }).then(r => r.data),
    enabled: !!viewOrg?.id && viewTab === 'history',
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => orgsApi.create(d),
    onSuccess: () => { toast.success('Company created'); qc.invalidateQueries({ queryKey: ['orgs'] }); setShowAdd(false); setForm(BLANK) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => orgsApi.suspend(id, reason),
    onSuccess: () => { toast.success('Company suspended'); qc.invalidateQueries({ queryKey: ['orgs'] }) },
  })

  // Per-org feature flag toggle for the MCQ-only Quiz mode. Backend
  // gates scheduling + reports listing on this; the HR portal reads it
  // out of /branding to conditionally show the menu + scheduling option.
  const quizToggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      orgsApi.setQuizEnabled(id, enabled),
    onSuccess: (_res, vars) => {
      toast.success(vars.enabled ? 'Quiz feature ENABLED for this org' : 'Quiz feature disabled')
      qc.invalidateQueries({ queryKey: ['orgs'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Toggle failed'),
  })

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite({ email: inviteEmail, role: inviteRole, organizationId: viewOrg.id }),
    onSuccess: () => { toast.success('Invitation sent — user will receive an email'); qc.invalidateQueries({ queryKey: ['org-users', viewOrg?.id] }); setInviteEmail('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const deactivateUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['org-users', viewOrg?.id] }) },
  })

  const orgs: any[] = data?.organizations || data || []
  const orgUserList: any[] = orgUsers?.users || orgUsers || []
  const orgReportList: any[] = orgReports?.reports || orgReports || []
  const detail = orgDetail || viewOrg

  const creditUsed = detail?.creditsUsed || 0
  const creditTotal = detail?.assessmentCredits || 100
  const creditPct = Math.min(100, Math.round((creditUsed / creditTotal) * 100))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Companies</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{Array.isArray(orgs) ? orgs.length : 0} registered companies</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> Add Company
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '400px' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Company</th><th>Industry</th><th>Country</th><th>Credits</th><th>Status</th><th>Features</th><th>Contact</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} style={{ padding: '12px 24px' }}>
                <SkeletonList count={5} rowHeight={48} />
              </td></tr>
            ) : !Array.isArray(orgs) || !orgs.length ? (
              <tr><td colSpan={8}>
                <EmptyState
                  icon={<Building2 size={26} />}
                  title={search ? 'No companies match this search' : 'No companies yet'}
                  description={search
                    ? 'Try a different name or leave the search box empty to see all companies.'
                    : 'Add a client company to start scheduling assessments and managing HR users.'}
                />
              </td></tr>
            ) : orgs.map((o: any) => (
              <tr key={o.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Building2 size={16} color="var(--cyan)" />
                    <div>
                      <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-primary)' }}>{o.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{o.slug}</p>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: '13px' }}>{o.industry}</td>
                <td style={{ fontSize: '13px' }}>{o.country}{o.city ? `, ${o.city}` : ''}</td>
                <td>
                  <div>
                    <span style={{ fontSize: '13px' }}>{o.assessmentCredits - (o.creditsUsed || 0)} / {o.assessmentCredits}</span>
                    <div style={{ height: '3px', background: 'var(--bg-elevated)', borderRadius: '2px', marginTop: '3px', width: '60px' }}>
                      <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${Math.min(100, Math.round(((o.creditsUsed || 0) / o.assessmentCredits) * 100))}%` }} />
                    </div>
                  </div>
                </td>
                <td><span className={`badge ${o.status === 'ACTIVE' ? 'badge-pass' : o.status === 'TRIAL' ? 'badge-pending' : 'badge-fail'}`}>{o.status}</span></td>
                <td>
                  <label title={o.quizEnabled ? 'Quiz mode enabled — HR can schedule MCQ-only assessments' : 'Quiz mode disabled — toggle to enable for this org'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: o.quizEnabled ? 'var(--emerald)' : 'var(--text-muted)' }}>
                    <input type="checkbox"
                      checked={!!o.quizEnabled}
                      disabled={quizToggleMutation.isPending}
                      onChange={e => quizToggleMutation.mutate({ id: o.id, enabled: e.target.checked })}
                      style={{ accentColor: 'var(--cyan)', cursor: 'pointer' }} />
                    Quiz
                  </label>
                </td>
                <td style={{ fontSize: '12px' }}>{o.primaryContactEmail || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {o.contractEndDate && (() => {
                      const daysLeft = Math.ceil((new Date(o.contractEndDate).getTime() - Date.now()) / 86400000)
                      if (daysLeft <= 30) return <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(225,29,72,0.15)', color: 'var(--rose)', fontWeight: '600' }}>⚠ {daysLeft}d</span>
                      if (daysLeft <= 90) return <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(215,119,6,0.15)', color: 'var(--amber)', fontWeight: '600' }}>⚠ {daysLeft}d</span>
                      return null
                    })()}
                    <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      onClick={() => { setViewOrg(o); setViewTab('overview') }}>
                      View <ChevronRight size={11} />
                    </button>
                    {o.status === 'ACTIVE' && (
                      <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: '12px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                        onClick={() => { const r = prompt('Reason for suspension?'); if (r) suspendMutation.mutate({ id: o.id, reason: r }) }}>
                        Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── COMPANY DETAIL DRAWER ── */}
      {viewOrg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '680px', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            {/* Drawer header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{detail?.name}</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>{detail?.industry} · {detail?.country}</p>
              </div>
              <button onClick={() => setViewOrg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {(['overview', 'users', 'history', 'notes'] as const).map(tab => (
                <button key={tab} onClick={() => setViewTab(tab)}
                  style={{ flex: 1, padding: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: viewTab === tab ? '600' : '400', color: viewTab === tab ? 'var(--cyan)' : 'var(--text-muted)', borderBottom: viewTab === tab ? '2px solid var(--cyan)' : '2px solid transparent', textTransform: 'capitalize' }}>
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px 24px', flex: 1 }}>
              {/* OVERVIEW TAB */}
              {viewTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Credit usage */}
                  <div className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Assessment Credits</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{creditUsed} / {creditTotal} used ({creditPct}%)</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>
                      <div style={{ height: '100%', background: creditPct > 80 ? 'var(--rose)' : creditPct > 60 ? 'var(--amber)' : 'var(--emerald)', borderRadius: '4px', width: `${creditPct}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining: {creditTotal - creditUsed}</span>
                      <span className={`badge ${detail?.status === 'ACTIVE' ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{detail?.status}</span>
                    </div>
                  </div>

                  {/* Company details grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {[
                      ['Company Name', detail?.name],
                      ['Slug', detail?.slug],
                      ['Industry', detail?.industry],
                      ['Size', detail?.size || '—'],
                      ['Country', detail?.country],
                      ['City', detail?.city || '—'],
                      ['Website', detail?.website || '—'],
                      ['Account Tier', detail?.accountTier || '—'],
                      ['Primary Contact', detail?.primaryContactName || '—'],
                      ['Contact Email', detail?.primaryContactEmail || '—'],
                      ['Contact Phone', detail?.primaryContactPhone || '—'],
                    ].map(([l, v]) => (
                      <div key={l} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '6px' }}>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{l}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-primary)' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* USERS TAB */}
              {viewTab === 'users' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input className="form-input" placeholder="Email address..." value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
                    <select className="form-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: '160px' }}>
                      <option value="HR_MANAGER">HR Manager</option>
                      <option value="HIRING_MANAGER">Hiring Manager</option>
                      <option value="ORG_ADMIN">Org Admin</option>
                    </select>
                    <button className="btn-primary" onClick={() => inviteMutation.mutate()} disabled={!inviteEmail.trim() || inviteMutation.isPending} style={{ whiteSpace: 'nowrap' }}>
                      {inviteMutation.isPending ? 'Inviting...' : '+ Invite'}
                    </button>
                  </div>
                  {!orgUserList.length ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No users yet.</p>
                  ) : orgUserList.map((u: any) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '6px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</p>
                        <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>{u.email} · {u.role.replace(/_/g, ' ')}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${u.status === 'ACTIVE' ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{u.status}</span>
                        {u.status === 'ACTIVE' && (
                          <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}
                            onClick={() => { if (confirm(`Deactivate ${u.firstName}?`)) deactivateUserMutation.mutate(u.id) }}>
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* HISTORY TAB */}
              {viewTab === 'history' && (
                <div>
                  {!orgReportList.length ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No assessment history yet.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Candidate</th><th>Assessment</th><th>Date</th><th>Score</th><th>Result</th></tr>
                      </thead>
                      <tbody>
                        {orgReportList.map((r: any) => (
                          <tr key={r.id}>
                            <td style={{ fontSize: '13px' }}>{r.session?.candidate?.firstName} {r.session?.candidate?.lastName}</td>
                            <td style={{ fontSize: '12px' }}>{r.session?.assessmentType?.name}</td>
                            <td style={{ fontSize: '12px' }}>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}</td>
                            <td style={{ fontSize: '13px', fontWeight: '600' }}>{r.overallScore?.toFixed(1)}%</td>
                            <td><span className={`badge ${r.overallPassed ? 'badge-pass' : 'badge-fail'}`} style={{ fontSize: '11px' }}>{r.overallPassed ? 'PASS' : 'FAIL'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* NOTES TAB */}
              {viewTab === 'notes' && (
                <div>
                  <textarea className="form-input" rows={5} value={orgNote} onChange={e => setOrgNote(e.target.value)}
                    placeholder="Add internal notes about this company (Admin-only, not visible to HR)..." style={{ resize: 'vertical', marginBottom: '10px' }} />
                  <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}
                    onClick={() => { orgsApi.update(viewOrg.id, { internalNotes: orgNote }); toast.success('Notes saved') }}>
                    Save Notes
                  </button>
                  {detail?.internalNotes && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {detail.internalNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ADD COMPANY MODAL ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '560px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Company</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[['name', 'Company Name *', true], ['slug', 'Slug (unique) *', true], ['country', 'Country *', true], ['city', 'City', false], ['industry', 'Industry *', true], ['size', 'Company Size', false]].map(([k, l, req]) => (
                  <div key={k as string}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
                    <input className="form-input" required={req as boolean} value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[['primaryContactName', 'Contact Name', false], ['primaryContactEmail', 'Contact Email', false], ['primaryContactPhone', 'Contact Phone', false], ['website', 'Website', false]].map(([k, l]) => (
                  <div key={k as string}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
                    <input className="form-input" value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Assessment Credits</label>
                  <input className="form-input" type="number" value={form.assessmentCredits} onChange={e => setForm(f => ({ ...f, assessmentCredits: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Account Tier</label>
                  <select className="form-input" value={form.accountTier} onChange={e => setForm(f => ({ ...f, accountTier: e.target.value }))}>
                    {['STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
