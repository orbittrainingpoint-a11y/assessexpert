'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, adminApi, recordingsApi } from '@/lib/api'
import { MessageSquare, Video, X } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminReportsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [commentModal, setCommentModal] = useState<{ id: string; name: string } | null>(null)
  const [comment, setComment] = useState('')
  const [commentType, setCommentType] = useState('GENERAL')
  const [recordingModal, setRecordingModal] = useState<{ sessionId: string; name: string; url: string } | null>(null)

  const { data: reports, isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => reportsApi.getAll({ status: statusFilter || undefined, limit: 200 }).then(r => r.data),
  })

  const handleWatchRecording = async (sessionId: string, name: string) => {
    try {
      const { data } = await recordingsApi.getUrl(sessionId)
      setRecordingModal({ sessionId, name, url: data.url })
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Recording not available or expired')
    }
  }

  const commentMutation = useMutation({
    mutationFn: () => adminApi.addReportComment(commentModal!.id, comment, commentType),
    onSuccess: () => { toast.success('Comment added'); setCommentModal(null); setComment(''); qc.invalidateQueries({ queryKey: ['admin-reports'] }) },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const list = reports?.reports || reports || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>All Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Platform-wide report oversight</p>
        </div>
        <select className="form-input" style={{ width: '200px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['DRAFT', 'PENDING_REVIEW', 'RETURNED', 'PUBLISHED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Candidate</th><th>Assessment</th><th>Company</th><th>MCQ</th><th>Overall</th><th>Result</th><th>Status</th><th>Published</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
            ) : !Array.isArray(list) || !list.length ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reports found.</td></tr>
            ) : list.map((r: any) => (
              <tr key={r.id}>
                <td style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{r.session?.candidate?.firstName} {r.session?.candidate?.lastName}</td>
                <td style={{ fontSize: '13px' }}>{r.session?.assessmentType?.name}</td>
                <td style={{ fontSize: '13px' }}>{r.organization?.name}</td>
                <td>{r.mcqScore?.toFixed(1)}%</td>
                <td style={{ fontWeight: '600' }}>{r.overallScore?.toFixed(1)}%</td>
                <td><span className={`badge ${r.overallPassed ? 'badge-pass' : 'badge-fail'}`}>{r.overallPassed ? 'PASS' : 'FAIL'}</span></td>
                <td><span className={`badge ${r.status === 'PUBLISHED' ? 'badge-pass' : r.status === 'PENDING_REVIEW' ? 'badge-pending' : 'badge-draft'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                <td style={{ fontSize: '12px' }}>{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-ghost" style={{ padding: '5px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--cyan)', borderColor: 'rgba(0,212,255,0.3)' }}
                      onClick={() => handleWatchRecording(r.sessionId, `${r.session?.candidate?.firstName} ${r.session?.candidate?.lastName}`)}>
                      <Video size={11} /> Recording
                    </button>
                    <button className="btn-ghost" style={{ padding: '5px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      onClick={() => setCommentModal({ id: r.id, name: `${r.session?.candidate?.firstName} ${r.session?.candidate?.lastName}` })}>
                      <MessageSquare size={11} /> Comment
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RECORDING MODAL */}
      {recordingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Recording — {recordingModal.name}</span>
            <button onClick={() => setRecordingModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Candidate Webcam</p>
              <video controls style={{ width: '100%', borderRadius: '8px', background: '#000', flex: 1 }} src={recordingModal.url} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Screen Recording</p>
              <div style={{ flex: 1, background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Screen recording (synced)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {commentModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '480px', padding: '28px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Add Admin Comment</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-muted)' }}>{commentModal.name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Comment Type</label>
                <select className="form-input" value={commentType} onChange={e => setCommentType(e.target.value)}>
                  {['GENERAL', 'QUALITY_FLAG', 'ESCALATION', 'APPROVAL'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Comment</label>
                <textarea className="form-input" rows={4} value={comment} onChange={e => setComment(e.target.value)} placeholder="Enter your comment..." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-ghost" onClick={() => setCommentModal(null)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn-primary" onClick={() => commentMutation.mutate()} disabled={!comment.trim() || commentMutation.isPending} style={{ flex: 1 }}>
                  {commentMutation.isPending ? 'Saving...' : 'Add Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
