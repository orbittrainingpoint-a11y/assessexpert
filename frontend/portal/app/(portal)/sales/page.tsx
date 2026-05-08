'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesApi } from '@/lib/api'
import { StatCard } from '@/components/ui/StatCard'
import { Users, Building2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SalesDashboard() {
  const qc = useQueryClient()
  const { data: stats } = useQuery({ queryKey: ['sales-stats'], queryFn: () => salesApi.getStats().then(r => r.data) })
  const { data: leads } = useQuery({ queryKey: ['leads'], queryFn: () => salesApi.getLeads().then(r => r.data) })

  const updateLead = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => salesApi.updateLead(id, { status }),
    onSuccess: () => { toast.success('Lead updated'); qc.invalidateQueries({ queryKey: ['leads'] }) },
  })

  const LEAD_STATUSES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST']

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Sales Dashboard</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="New Leads This Week" value={stats?.newLeads ?? '—'} icon={<Users size={20} />} color="cyan" />
        <StatCard label="Renewals Due (90 days)" value={stats?.renewalsDue ?? '—'} icon={<AlertCircle size={20} />} color="amber" />
        <StatCard label="My Companies" value={stats?.myCompanies ?? '—'} icon={<Building2 size={20} />} color="emerald" />
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Leads Pipeline</h3>
        <table className="data-table">
          <thead>
            <tr><th>Company</th><th>Contact</th><th>Email</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!leads?.length ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No leads yet</td></tr>
            ) : leads.map((l: any) => (
              <tr key={l.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{l.companyName}</td>
                <td>{l.fullName}</td>
                <td>{l.email}</td>
                <td>
                  <span className={`badge ${l.status === 'CONVERTED' ? 'badge-pass' : l.status === 'LOST' ? 'badge-fail' : l.status === 'NEW' ? 'badge-live' : 'badge-pending'}`}>
                    {l.status}
                  </span>
                </td>
                <td>
                  <select
                    value={l.status}
                    onChange={e => updateLead.mutate({ id: l.id, status: e.target.value })}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
