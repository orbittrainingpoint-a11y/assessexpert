'use client'
import { useAuthStore } from '@/store/auth.store'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import toast from 'react-hot-toast'

export default function ExamSetupSettingsPage() {
  const { user } = useAuthStore()
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(current, newPw),
    onSuccess: () => { toast.success('Password changed'); setCurrent(''); setNewPw(''); setConfirm('') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirm) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    changePwMutation.mutate()
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Your account preferences</p>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Profile</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[['Name', `${user?.firstName} ${user?.lastName}`], ['Email', user?.email || ''], ['Role', user?.role?.replace(/_/g, ' ') || '']].map(([l, v]) => (
            <div key={l}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</p>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-primary)' }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Change Password</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[['Current Password', current, setCurrent], ['New Password', newPw, setNewPw], ['Confirm New Password', confirm, setConfirm]].map(([l, v, s]) => (
            <div key={l as string}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{l as string}</label>
              <input className="form-input" type="password" required value={v as string} onChange={e => (s as any)(e.target.value)} placeholder="••••••••" />
            </div>
          ))}
          <button type="submit" className="btn-primary" disabled={changePwMutation.isPending} style={{ marginTop: '4px' }}>
            {changePwMutation.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
