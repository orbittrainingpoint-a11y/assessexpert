'use client'
import { useState } from 'react'
import { AlertTriangle, AlertCircle, CheckCircle, X } from 'lucide-react'
import { proctoringApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface Flag {
  id: string
  eventType: string
  severity: 'WARNING' | 'CRITICAL'
  timestamp: string
  source: string
  candidateName?: string
}

interface Props {
  flags: Flag[]
  onFlagActioned: (id: string) => void
}

export default function FlagQueue({ flags, onFlagActioned }: Props) {
  const [acting, setActing] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ id: string; action: 'dismiss' | 'confirm' } | null>(null)
  const [note, setNote] = useState('')

  const handleAction = async (id: string, outcome: 'DISMISSED' | 'CONFIRMED', noteText: string) => {
    setActing(id)
    try {
      await proctoringApi.reviewFlag(id, outcome, noteText)
      toast.success(outcome === 'DISMISSED' ? 'Flag dismissed' : 'Flag confirmed as integrity concern')
      onFlagActioned(id)
    } catch {
      toast.error('Failed to action flag')
    } finally {
      setActing(null)
      setNoteModal(null)
      setNote('')
    }
  }

  const openModal = (id: string, action: 'dismiss' | 'confirm') => {
    setNoteModal({ id, action })
    setNote('')
  }

  const unresolved = flags.filter(f => f)

  if (!unresolved.length) return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
        AI Flags Queue
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(5,150,105,0.08)', borderRadius: '8px' }}>
        <CheckCircle size={16} color="var(--emerald)" />
        <span style={{ fontSize: '13px', color: 'var(--emerald)' }}>No unresolved flags</span>
      </div>
    </div>
  )

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
          AI Flags Queue
        </h3>
        <span style={{ padding: '3px 10px', borderRadius: '20px', background: 'rgba(225,29,72,0.12)', color: 'var(--rose)', fontSize: '12px', fontWeight: '600' }}>
          {unresolved.length} unresolved
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {unresolved.map(flag => {
          const isCritical = flag.severity === 'CRITICAL'
          const borderColor = isCritical ? 'rgba(225,29,72,0.3)' : 'rgba(215,119,6,0.3)'
          const bgColor = isCritical ? 'rgba(225,29,72,0.06)' : 'rgba(215,119,6,0.06)'
          const iconColor = isCritical ? 'var(--rose)' : 'var(--amber)'

          return (
            <div key={flag.id} style={{ padding: '12px 14px', borderRadius: '8px', background: bgColor, border: `1px solid ${borderColor}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                {isCritical
                  ? <AlertCircle size={15} color={iconColor} style={{ flexShrink: 0, marginTop: '1px' }} />
                  : <AlertTriangle size={15} color={iconColor} style={{ flexShrink: 0, marginTop: '1px' }} />
                }
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {flag.eventType.replace(/_/g, ' ')}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(flag.timestamp).toLocaleTimeString()} · {flag.source}
                    {flag.candidateName && ` · ${flag.candidateName}`}
                  </p>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: isCritical ? 'rgba(225,29,72,0.2)' : 'rgba(215,119,6,0.2)', color: iconColor, flexShrink: 0 }}>
                  {flag.severity}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => openModal(flag.id, 'dismiss')}
                  disabled={acting === flag.id}
                  style={{ flex: 1, padding: '7px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                >
                  Dismiss
                </button>
                <button
                  onClick={() => openModal(flag.id, 'confirm')}
                  disabled={acting === flag.id}
                  style={{ flex: 1, padding: '7px', borderRadius: '6px', border: `1px solid ${borderColor}`, background: bgColor, color: iconColor, fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}
                >
                  Confirm as Flag
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Note modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>
                {noteModal.action === 'dismiss' ? 'Dismiss Flag' : 'Confirm as Integrity Concern'}
              </h3>
              <button onClick={() => setNoteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {noteModal.action === 'dismiss'
                ? 'Add an optional note explaining why this flag is being dismissed.'
                : 'This flag will be included in the published report and will reduce the integrity score.'}
            </p>
            <textarea
              className="form-input"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={noteModal.action === 'dismiss' ? 'Reason for dismissal (optional)...' : 'Note for report (optional)...'}
              style={{ resize: 'vertical', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => setNoteModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => handleAction(noteModal.id, noteModal.action === 'dismiss' ? 'DISMISSED' : 'CONFIRMED', note)}
                disabled={acting === noteModal.id}
                style={{ flex: 1, background: noteModal.action === 'confirm' ? 'var(--rose)' : undefined, borderColor: noteModal.action === 'confirm' ? 'var(--rose)' : undefined }}
              >
                {acting === noteModal.id ? 'Saving...' : noteModal.action === 'dismiss' ? 'Dismiss Flag' : 'Confirm Flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
