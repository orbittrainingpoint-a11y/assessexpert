'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Clock, Video, Plus, X, Loader2, CheckCircle2, XCircle, AlertCircle, ArrowRight, Link2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { interviewsApi, candidatesApi } from '@/lib/api'

type Interview = {
  id: string
  candidateId: string
  scheduledAt: string
  format: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes?: string | null
  verdict?: string | null
  frVerdict?: string | null
  frSimilarity?: number | null
  manualVerified?: boolean | null
  magicToken?: string | null
}

const statusStyle = (s: string) => {
  switch (s) {
    case 'IN_PROGRESS': return { color: 'var(--cyan)', bg: 'rgba(0,212,255,0.1)', border: 'rgba(0,212,255,0.3)' }
    case 'COMPLETED': return { color: 'var(--emerald)', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' }
    case 'CANCELLED': return { color: 'var(--rose)', bg: 'rgba(225,29,72,0.1)', border: 'rgba(225,29,72,0.3)' }
    default: return { color: 'var(--amber)', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.3)' }
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function HRInterviewsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [showSchedule, setShowSchedule] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-interviews'],
    queryFn: () => interviewsApi.getAll().then(r => r.data),
    refetchInterval: 30_000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => interviewsApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-interviews'] }); toast.success('Interview cancelled') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Cancel failed'),
  })

  const list: Interview[] = Array.isArray(data) ? data : (data?.interviews || [])
  const groups = useMemo(() => ({
    active: list.filter(i => i.status === 'IN_PROGRESS'),
    upcoming: list.filter(i => i.status === 'SCHEDULED'),
    past: list.filter(i => ['COMPLETED', 'CANCELLED'].includes(i.status)),
  }), [list])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Interviews</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Schedule and conduct video interviews with candidates who have completed their assessment. Live facial recognition verifies the interviewee is the same person who took the exam.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowSchedule(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Schedule Interview
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-muted)', padding: '40px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 size={18} className="animate-spin" /> Loading interviews…
        </div>
      ) : list.length === 0 ? (
        <EmptyState onSchedule={() => setShowSchedule(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Section title="Live now" emoji="🔴" items={groups.active} onCancel={(id) => cancelMutation.mutate(id)} />
          <Section title="Upcoming" emoji="📅" items={groups.upcoming} onCancel={(id) => cancelMutation.mutate(id)} />
          <Section title="Past" emoji="🗂" items={groups.past} onCancel={(id) => cancelMutation.mutate(id)} compact />
        </div>
      )}

      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onScheduled={() => { setShowSchedule(false); qc.invalidateQueries({ queryKey: ['hr-interviews'] }) }}
        />
      )}
    </div>
  )
}

function Section({ title, emoji, items, onCancel, compact }: { title: string; emoji: string; items: Interview[]; onCancel: (id: string) => void; compact?: boolean }) {
  if (items.length === 0) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({items.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(i => <Row key={i.id} interview={i} onCancel={onCancel} compact={compact} />)}
      </div>
    </div>
  )
}

function Row({ interview: i, onCancel, compact }: { interview: Interview; onCancel: (id: string) => void; compact?: boolean }) {
  const st = statusStyle(i.status)
  const { data: cand } = useQuery({
    queryKey: ['candidate', i.candidateId],
    queryFn: () => candidatesApi.getOne(i.candidateId).then(r => r.data),
    enabled: !!i.candidateId,
    staleTime: 60_000,
  })
  const name = cand ? `${cand.firstName || ''} ${cand.lastName || ''}`.trim() || cand.email : 'Candidate'
  const canJoin = ['SCHEDULED', 'IN_PROGRESS'].includes(i.status)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: compact ? '12px 16px' : '16px 20px', background: 'var(--bg-surface)', border: `1px solid ${st.border}`, borderLeft: `3px solid ${st.color}`, borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
          <Video size={16} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, letterSpacing: '0.04em' }}>
              {i.status.replace('_', ' ')}
            </span>
            {i.frVerdict && (
              <VerifyChip verdict={i.frVerdict} similarity={i.frSimilarity} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} /> {fmtDate(i.scheduledAt)}</span>
            <span>{i.format}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {canJoin && (
          <Link href={`/hr/interviews/${i.id}`} className="btn-primary" style={{ padding: '8px 14px', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            {i.status === 'IN_PROGRESS' ? 'Rejoin' : 'Open'} <ArrowRight size={13} />
          </Link>
        )}
        {i.status === 'COMPLETED' && (
          <Link href={`/hr/interviews/${i.id}`} className="btn-ghost" style={{ padding: '8px 14px', fontSize: 13, textDecoration: 'none' }}>
            View
          </Link>
        )}
        {i.status === 'SCHEDULED' && i.magicToken && (
          <button onClick={() => {
            const url = `${window.location.origin}/interview/${i.magicToken}`
            navigator.clipboard.writeText(url).then(() => toast.success('Candidate link copied')).catch(() => toast.error('Copy failed'))
          }} title="Copy candidate join link" className="btn-ghost" style={{ padding: '8px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link2 size={12} /> Copy link
          </button>
        )}
        {i.status === 'SCHEDULED' && (
          <button onClick={() => { if (confirm('Cancel this interview?')) onCancel(i.id) }}
            className="btn-ghost" style={{ padding: '8px 12px', fontSize: 12, color: 'var(--rose)', borderColor: 'rgba(225,29,72,0.3)' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

function VerifyChip({ verdict, similarity }: { verdict: string; similarity?: number | null }) {
  const map: Record<string, { color: string; bg: string; icon: any; label: string }> = {
    VERIFIED: { color: 'var(--emerald)', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle2, label: 'FR ✓' },
    PENDING_REVIEW: { color: 'var(--amber)', bg: 'rgba(217,119,6,0.1)', icon: AlertCircle, label: 'FR ?' },
    REJECTED: { color: 'var(--rose)', bg: 'rgba(225,29,72,0.1)', icon: XCircle, label: 'FR ✗' },
  }
  const cfg = map[verdict] || map.PENDING_REVIEW
  const Icon = cfg.icon
  return (
    <span title={similarity != null ? `Similarity ${similarity.toFixed(1)}%` : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg }}>
      <Icon size={11} /> {cfg.label}{similarity != null ? ` ${similarity.toFixed(0)}%` : ''}
    </span>
  )
}

function EmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <div className="glass-card" style={{ padding: 60, textAlign: 'center' }}>
      <Video size={42} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px', fontSize: 18, color: 'var(--text-primary)' }}>No interviews yet</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, maxWidth: 460, marginInline: 'auto', lineHeight: 1.7 }}>
        Schedule an interview with a candidate after their assessment. They'll receive a magic-link to join; you'll see their live camera alongside their exam-time reference photo, with a one-click facial-recognition check.
      </p>
      <button className="btn-primary" onClick={onSchedule} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Plus size={16} /> Schedule your first interview
      </button>
    </div>
  )
}

function ScheduleModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: () => void }) {
  const [search, setSearch] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [pickedName, setPickedName] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')

  const { data: candidatesData, isLoading: searching } = useQuery({
    queryKey: ['cand-search', search],
    queryFn: () => candidatesApi.getAll({ search, limit: 10 }).then(r => r.data),
    enabled: search.length >= 2,
    staleTime: 10_000,
  })
  const candidates: any[] = candidatesData?.candidates || []

  const scheduleMutation = useMutation({
    mutationFn: () => interviewsApi.schedule({
      candidateId: pickedId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      format: 'VIDEO',
      notes: notes || undefined,
    }),
    onSuccess: () => { toast.success('Interview scheduled'); onScheduled() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Schedule failed'),
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="glass-card" style={{ width: '100%', maxWidth: 540, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Schedule Interview</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>The candidate will receive a magic link valid until 24h after the slot.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="iv-cand" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Candidate</label>
            {pickedId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--cyan)', borderRadius: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{pickedName}</span>
                <button onClick={() => { setPickedId(null); setPickedName(''); setSearch('') }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Change</button>
              </div>
            ) : (
              <>
                <input id="iv-cand" className="form-input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                {search.length >= 2 && (
                  <div style={{ marginTop: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {searching ? (
                      <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>Searching…</div>
                    ) : candidates.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>No candidates found.</div>
                    ) : candidates.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => {
                        setPickedId(c.id); setPickedName(`${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email)
                      }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 500 }}>{`${c.firstName || ''} ${c.lastName || ''}`.trim() || '(no name)'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="iv-when" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Date &amp; time</label>
            <input id="iv-when" className="form-input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>

          <div>
            <label htmlFor="iv-notes" style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>Note for HR (optional)</label>
            <textarea id="iv-notes" className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Topics to cover, exam follow-ups…" style={{ resize: 'vertical' }} />
          </div>

          <button type="button" className="btn-primary" disabled={!pickedId || !scheduledAt || scheduleMutation.isPending}
            onClick={() => scheduleMutation.mutate()}
            style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {scheduleMutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Scheduling…</> : <><Calendar size={16} /> Schedule interview</>}
          </button>
        </div>
      </div>
    </div>
  )
}
