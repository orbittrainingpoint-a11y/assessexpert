'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesApi } from '@/lib/api'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUSES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST']
const BLANK = { companyName: '', fullName: '', role: '', email: '', phone: '', companySize: '', message: '', assessmentTypes: [] as string[] }

const STATUS_BADGE: Record<string, string> = {
  NEW: 'badge-live', CONTACTED: 'badge-pending', DEMO_SCHEDULED: 'badge-pending',
  NEGOTIATING: 'badge-pending', CONVERTED: 'badge-pass', LOST: 'badge-fail',
}

export default function SalesLeadsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(BLANK)

  const { data, isLoading } = useQuery({
    queryKey: ['leads', statusFilter],
    queryFn: () => salesApi.getLeads({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (d: any) => salesApi.createLead(d),
    onSuccess: () => { toast.success('Lead created'); qc.invalidateQueries({ queryKey: ['leads'] }); setShowAdd(false); setForm(BLANK) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesApi.updateLead(id, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['leads'] }) },
  })

  const leads = data?.leads || data || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Leads Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{Array.isArray(leads) ? leads.length : 0} leads</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select className="form-input" style={{ width: '180px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} /> Add Lead
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Company</th><th>Contact</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th>Update Status</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(leads) || !leads.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No leads yet.</td></tr>
            ) : leads.map((l: any) => (
              <tr key={l.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{l.companyName}</td>
                <td>{l.fullName}</td>
                <td style={{ fontSize: '13px' }}>{l.role}</td>
                <td style={{ fontSize: '13px' }}>{l.email}</td>
                <td style={{ fontSize: '13px' }}>{l.phone || '—'}</td>
                <td><span className={`badge ${STATUS_BADGE[l.status] || 'badge-draft'}`}>{l.status.replace(/_/g, ' ')}</span></td>
                <td>
                  <select value={l.status} onChange={e => updateMutation.mutate({ id: l.id, status: e.target.value })}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-card" style={{ width: '520px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Lead</h2>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[['companyName', 'Company Name *', true], ['fullName', 'Contact Name *', true], ['role', 'Their Role *', true], ['email', 'Email *', true], ['phone', 'Phone', false], ['companySize', 'Company Size', false]].map(([k, l, req]) => (
                  <div key={k as string}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
                    <input className="form-input" required={req as boolean} value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Notes</label>
                <textarea className="form-input" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending} style={{ flex: 1 }}>
                  {createMutation.isPending ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
