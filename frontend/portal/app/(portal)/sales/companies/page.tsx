'use client'
import { useQuery } from '@tanstack/react-query'
import { salesApi } from '@/lib/api'
import { Building2 } from 'lucide-react'

export default function SalesCompaniesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-companies'],
    queryFn: () => salesApi.getCompanies().then(r => r.data),
  })

  const companies = data?.companies || data || []

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>My Companies</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          {Array.isArray(companies) ? companies.length : 0} active client companies
        </p>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Company</th><th>Industry</th><th>Country</th><th>Credits Remaining</th><th>Contract End</th><th>Status</th><th>Contact</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(companies) || !companies.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No companies assigned to you yet.</td></tr>
            ) : companies.map((c: any) => {
              const creditsLeft = c.assessmentCredits - (c.creditsUsed || 0)
              const contractEnd = c.contractEndDate ? new Date(c.contractEndDate) : null
              const daysLeft = contractEnd ? Math.ceil((contractEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Building2 size={16} color="var(--cyan)" />
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-primary)' }}>{c.name}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>{c.accountTier}</p>
                      </div>
                    </div>
                  </td>
                  <td>{c.industry}</td>
                  <td>{c.country}{c.city ? `, ${c.city}` : ''}</td>
                  <td>
                    <span style={{ color: creditsLeft <= 10 ? 'var(--rose)' : creditsLeft <= 25 ? 'var(--amber)' : 'var(--emerald)', fontWeight: '600' }}>
                      {creditsLeft}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> / {c.assessmentCredits}</span>
                  </td>
                  <td style={{ fontSize: '13px' }}>
                    {contractEnd ? (
                      <span style={{ color: daysLeft !== null && daysLeft <= 90 ? 'var(--amber)' : 'var(--text-secondary)' }}>
                        {contractEnd.toLocaleDateString()}
                        {daysLeft !== null && daysLeft <= 90 && <span style={{ fontSize: '11px', marginLeft: '4px' }}>({daysLeft}d)</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td><span className={`badge ${c.status === 'ACTIVE' ? 'badge-pass' : c.status === 'TRIAL' ? 'badge-pending' : 'badge-fail'}`}>{c.status}</span></td>
                  <td style={{ fontSize: '12px' }}>{c.primaryContactEmail || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
