'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, orgsApi, assessmentsApi } from '@/lib/api'
import { Plus, Search, KeyRound, RotateCcw, Trash2, Pencil, Mail, X as XIcon, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['SUPER_ADMIN', 'MASTER_PROCTOR', 'EXAM_SETUP_MASTER', 'SALES_AGENT', 'ORG_ADMIN', 'HR_MANAGER', 'HIRING_MANAGER', 'PROCTOR']
const CERT_LEVELS = ['JUNIOR', 'SENIOR', 'LEAD']
const REGIONS = ['GCC', 'MENA', 'EUROPE', 'GLOBAL']
const LANGUAGES = ['English', 'Arabic', 'French', 'Urdu', 'Hindi']

// password is intentionally excluded from BLANK to avoid hardcoded credential scanner false positives
const BLANK = {
  email: '', firstName: '', lastName: '', role: 'HR_MANAGER', phone: '',
  organizationId: '', certificationLevel: 'JUNIOR',
  certificationDomains: [] as string[], languages: [] as string[],
  workingTimezone: 'Asia/Dubai', maxSessionsPerDay: 4,
  specialistDomains: [] as string[], accessLevel: 'FULL',
  region: 'GCC', monthlyTarget: 5,
}

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...BLANK })
  // password kept separate so no static credential string exists in source
  const [newUserPassword, setNewUserPassword] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: () => usersApi.getAll({ search, role: roleFilter || undefined, limit: 100 }).then(r => r.data),
  })

  const { data: orgs } = useQuery({ queryKey: ['orgs-list'], queryFn: () => orgsApi.getAll({ limit: 200 }).then(r => r.data) })
  const { data: atData } = useQuery({ queryKey: ['at-list'], queryFn: () => assessmentsApi.getAll({ limit: 100 }).then(r => r.data) })

  const createMutation = useMutation({
    mutationFn: (d: any) => usersApi.create(d),
    onSuccess: () => {
      toast.success('User created successfully')
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowAdd(false)
      setForm({ ...BLANK })
      setNewUserPassword('')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Deactivation failed'),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.reactivate(id),
    onSuccess: () => { toast.success('User reactivated'); qc.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reactivation failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { toast.success('User deleted'); qc.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Delete failed'),
  })

  const sendResetMutation = useMutation({
    mutationFn: (id: string) => usersApi.sendPasswordReset(id),
    onSuccess: () => toast.success('Password reset link emailed to the user (valid 1 hour)'),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Could not send reset link'),
  })

  // Edit modal state — populated when user clicks Edit on a row. Uses
  // the same field shape as the create form; only editable fields
  // that the backend allowlist accepts (see users.service
  // USER_WRITABLE_FIELDS from SAST P0 #2).
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    email: '', firstName: '', lastName: '', role: 'HR_MANAGER',
    organizationId: '', certificationLevel: '', maxSessionsPerDay: 4,
  })
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      toast.success('User updated')
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditingUser(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Update failed'),
  })

  // Invitations panel — separate query so we can refresh independently
  // of the users list.
  const { data: invitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => usersApi.listInvitations({ limit: 50 }).then(r => r.data),
  })
  const resendMutation = useMutation({
    mutationFn: (id: string) => usersApi.resendInvitation(id),
    onSuccess: () => { toast.success('Invitation resent'); qc.invalidateQueries({ queryKey: ['invitations'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Resend failed'),
  })
  const revokeMutation = useMutation({
    mutationFn: (id: string) => usersApi.revokeInvitation(id),
    onSuccess: () => { toast.success('Invitation revoked'); qc.invalidateQueries({ queryKey: ['invitations'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Revoke failed'),
  })

  const openEdit = (u: any) => {
    setEditForm({
      email: u.email || '',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      role: u.role || 'HR_MANAGER',
      organizationId: u.organizationId || '',
      certificationLevel: u.certificationLevel || '',
      maxSessionsPerDay: u.maxSessionsPerDay || 4,
    })
    setEditingUser(u)
  }

  const users: any[] = data?.users || data || []
  const orgList: any[] = orgs?.organizations || orgs || []
  const atList: any[] = atData?.assessmentTypes || atData || []
  const needsOrg = ['ORG_ADMIN', 'HR_MANAGER', 'HIRING_MANAGER'].includes(form.role)
  const isProctor = form.role === 'PROCTOR'
  const isESM = form.role === 'EXAM_SETUP_MASTER'
  const isSales = form.role === 'SALES_AGENT'

  const toggleArr = (field: 'certificationDomains' | 'languages' | 'specialistDomains', val: string) => {
    setForm(f => {
      const arr = f[field] as string[]
      return { ...f, [field]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Users</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{Array.isArray(users) ? users.length : 0} total users</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> Add User
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px' }} />
        </div>
        <select className="form-input" style={{ width: '200px' }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Organization</th><th>Status</th><th>Last Login</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(users) || !users.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No users found.</td></tr>
            ) : users.map((u: any) => (
              <tr key={u.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{u.firstName} {u.lastName}</td>
                <td style={{ fontSize: '13px' }}>{u.email}</td>
                <td><span className="badge badge-live" style={{ fontSize: '11px' }}>{u.role.replace(/_/g, ' ')}</span></td>
                <td style={{ fontSize: '13px' }}>{u.organization?.name || '—'}</td>
                <td><span className={`badge ${u.status === 'ACTIVE' ? 'badge-pass' : 'badge-fail'}`}>{u.status}</span></td>
                <td style={{ fontSize: '12px' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {u.status !== 'DELETED' && (
                      <button className="btn-ghost" title="Edit user profile"
                        style={{ padding: '5px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => openEdit(u)}>
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                    {u.status === 'ACTIVE' && (
                      <>
                        <button className="btn-ghost" title="Send a 1-hour password reset link to the user's email"
                          style={{ padding: '5px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => { if (confirm(`Email a password reset link to ${u.email}?`)) sendResetMutation.mutate(u.id) }}
                          disabled={sendResetMutation.isPending}>
                          <KeyRound size={12} /> Reset link
                        </button>
                        <button className="btn-ghost" title="Deactivate — user can't log in until reactivated"
                          style={{ padding: '5px 8px', fontSize: '11px', color: 'var(--amber)', borderColor: 'rgba(217,119,6,0.3)' }}
                          onClick={() => { if (confirm(`Deactivate ${u.firstName}? They won't be able to log in until reactivated.`)) deactivateMutation.mutate(u.id) }}
                          disabled={deactivateMutation.isPending}>
                          Deactivate
                        </button>
                      </>
                    )}
                    {u.status === 'INACTIVE' && (
                      <button className="btn-ghost" title="Reactivate — restore login access"
                        style={{ padding: '5px 8px', fontSize: '11px', color: 'var(--emerald)', borderColor: 'rgba(5,150,105,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => reactivateMutation.mutate(u.id)}
                        disabled={reactivateMutation.isPending}>
                        <RotateCcw size={12} /> Reactivate
                      </button>
                    )}
                    {u.status !== 'DELETED' && (
                      <button className="btn-ghost" title="Soft-delete — row preserved for audit but user is gone"
                        style={{ padding: '5px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => { if (confirm(`Delete ${u.firstName} ${u.lastName}?\n\nThis is a soft delete — the row is preserved for audit trail, but the user is removed from every list. Cannot be undone through the UI.`)) deleteMutation.mutate(u.id) }}
                        disabled={deleteMutation.isPending}>
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD USER MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '560px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add User</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, password: newUserPassword }) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Role *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {ROLES.map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${form.role === r ? 'var(--cyan)' : 'var(--border)'}`, background: form.role === r ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: form.role === r ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', fontWeight: form.role === r ? '600' : '400' }}>
                      {r.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>First Name *</label>
                  <input className="form-input" required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Last Name *</label>
                  <input className="form-input" required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email *</label>
                <input className="form-input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Password *</label>
                  <input className="form-input" type="password" required value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>

              {needsOrg && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Organization *</label>
                  <select className="form-input" required value={form.organizationId} onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}>
                    <option value="">Select organization...</option>
                    {orgList.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}

              {isProctor && (
                <div style={{ padding: '12px', background: 'rgba(0,212,255,0.04)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.15)' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proctor Settings</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Certification Level</label>
                      <select className="form-input" value={form.certificationLevel} onChange={e => setForm(f => ({ ...f, certificationLevel: e.target.value }))}>
                        {CERT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Max Sessions/Day</label>
                      <input className="form-input" type="number" min={1} max={10} value={form.maxSessionsPerDay} onChange={e => setForm(f => ({ ...f, maxSessionsPerDay: parseInt(e.target.value) }))} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Working Timezone</label>
                      <select className="form-input" value={form.workingTimezone} onChange={e => setForm(f => ({ ...f, workingTimezone: e.target.value }))}>
                        {['Asia/Dubai', 'Asia/Riyadh', 'Europe/London', 'America/New_York', 'Asia/Karachi'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Certification Domains</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {atList.slice(0, 8).map((a: any) => (
                        <button key={a.id} type="button" onClick={() => toggleArr('certificationDomains', a.id)}
                          style={{ padding: '3px 8px', borderRadius: '12px', border: `1px solid ${form.certificationDomains.includes(a.id) ? 'var(--cyan)' : 'var(--border)'}`, background: form.certificationDomains.includes(a.id) ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: form.certificationDomains.includes(a.id) ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Languages</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {LANGUAGES.map(l => (
                        <button key={l} type="button" onClick={() => toggleArr('languages', l)}
                          style={{ padding: '3px 8px', borderRadius: '12px', border: `1px solid ${form.languages.includes(l) ? 'var(--cyan)' : 'var(--border)'}`, background: form.languages.includes(l) ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: form.languages.includes(l) ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isESM && (
                <div style={{ padding: '12px', background: 'rgba(0,212,255,0.04)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.15)' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exam Setup Master Settings</p>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Access Level</label>
                    <select className="form-input" value={form.accessLevel} onChange={e => setForm(f => ({ ...f, accessLevel: e.target.value }))}>
                      <option value="FULL">Full Access</option>
                      <option value="DOMAIN_RESTRICTED">Domain Restricted</option>
                    </select>
                  </div>
                  {form.accessLevel === 'DOMAIN_RESTRICTED' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Specialist Domains</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {atList.slice(0, 8).map((a: any) => (
                          <button key={a.id} type="button" onClick={() => toggleArr('specialistDomains', a.id)}
                            style={{ padding: '3px 8px', borderRadius: '12px', border: `1px solid ${form.specialistDomains.includes(a.id) ? 'var(--cyan)' : 'var(--border)'}`, background: form.specialistDomains.includes(a.id) ? 'rgba(0,212,255,0.1)' : 'var(--bg-elevated)', color: form.specialistDomains.includes(a.id) ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                            {a.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isSales && (
                <div style={{ padding: '12px', background: 'rgba(0,212,255,0.04)', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.15)' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales Agent Settings</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Region</label>
                      <select className="form-input" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>
                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Monthly Target (companies)</label>
                      <input className="form-input" type="number" min={1} value={form.monthlyTarget} onChange={e => setForm(f => ({ ...f, monthlyTarget: parseInt(e.target.value) }))} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => { setShowAdd(false); setNewUserPassword('') }} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL — subset of fields the SAST P0 #2 allowlist
          accepts. shortCode-style fields not present because User has
          no immutable-once-set identifier. */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '520px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Edit User</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)' }}>{editingUser.firstName} {editingUser.lastName} · {editingUser.email}</p>
            <form onSubmit={e => { e.preventDefault(); editMutation.mutate({ id: editingUser.id, data: editForm }) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Role</label>
                <select className="form-input" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>First Name</label>
                  <input className="form-input" value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Last Name</label>
                  <input className="form-input" value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
                <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              {['ORG_ADMIN', 'HR_MANAGER', 'HIRING_MANAGER'].includes(editForm.role) && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Organization</label>
                  <select className="form-input" value={editForm.organizationId} onChange={e => setEditForm(f => ({ ...f, organizationId: e.target.value }))}>
                    <option value="">Select organization...</option>
                    {orgList.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
              {editForm.role === 'PROCTOR' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Certification Level</label>
                    <select className="form-input" value={editForm.certificationLevel} onChange={e => setEditForm(f => ({ ...f, certificationLevel: e.target.value }))}>
                      <option value="">—</option>
                      {CERT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Max Sessions/Day</label>
                    <input className="form-input" type="number" min={1} max={10} value={editForm.maxSessionsPerDay} onChange={e => setEditForm(f => ({ ...f, maxSessionsPerDay: parseInt(e.target.value) }))} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setEditingUser(null)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editMutation.isPending} style={{ flex: 1 }}>
                  {editMutation.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITATIONS PANEL — visible below the users list. Shows every
          invitation the admin has sent with computed status. Resend
          for pending/expired; revoke removes unaccepted rows. */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Invitations</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            {Array.isArray(invitations) ? `${invitations.length} sent` : ''}
          </p>
        </div>
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>Email</th><th>Role</th><th>Organization</th><th>Sent</th><th>Expires</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {!Array.isArray(invitations) || invitations.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>No invitations sent yet.</td></tr>
              ) : invitations.map((inv: any) => (
                <tr key={inv.id}>
                  <td style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{inv.email}</td>
                  <td><span className="badge badge-live" style={{ fontSize: '11px' }}>{inv.role.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontSize: '13px' }}>{inv.organization?.name || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td style={{ fontSize: '12px' }}>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${inv.status === 'ACCEPTED' ? 'badge-pass' : inv.status === 'EXPIRED' ? 'badge-fail' : 'badge-draft'}`}>
                      {inv.status === 'ACCEPTED' ? <><ShieldCheck size={10} style={{ verticalAlign: -1, marginRight: 3 }} />ACCEPTED</> : inv.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {inv.status !== 'ACCEPTED' && (
                        <>
                          <button className="btn-ghost" title="Resend the invitation email + refresh the token"
                            style={{ padding: '5px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => resendMutation.mutate(inv.id)} disabled={resendMutation.isPending}>
                            <Mail size={12} /> Resend
                          </button>
                          <button className="btn-ghost" title="Delete this invitation — the emailed link stops working"
                            style={{ padding: '5px 8px', fontSize: '11px', color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => { if (confirm(`Revoke invitation to ${inv.email}?`)) revokeMutation.mutate(inv.id) }}
                            disabled={revokeMutation.isPending}>
                            <XIcon size={12} /> Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
