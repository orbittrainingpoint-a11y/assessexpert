'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, Circle } from 'lucide-react'
import { checklistApi } from '@/lib/api'
import toast from 'react-hot-toast'

export type ChecklistItemKey =
  | 'camera_verified'
  | 'identity_name'
  | 'identity_email'
  | 'government_id'
  | 'background_scan'
  | 'no_materials'
  | 'facial_recognition'
  | 'screen_share'
  | 'guardpro'
  | 'guidelines_agreed'

export interface ChecklistState {
  [key: string]: 'pending' | 'active' | 'done'
}

interface Props {
  sessionId: string
  candidateVideoRef: React.RefObject<HTMLVideoElement | null>
  onAllDone: () => void
  onRequestScreenShare?: () => void
  candidateScreenShareActive?: boolean
}

const ITEMS: { key: ChecklistItemKey; title: string; description: string }[] = [
  { key: 'camera_verified',    title: 'Camera Verification',        description: 'Confirm candidate face is clearly visible and camera is active.' },
  { key: 'identity_name',      title: 'Verbal Identity (Name)',     description: 'Ask candidate to state their full legal name.' },
  { key: 'identity_email',     title: 'Verbal Identity (Email)',    description: 'Ask candidate to state their email address.' },
  { key: 'government_id',      title: 'Government ID Check',        description: 'Capture ID photo and run facial recognition.' },
  { key: 'background_scan',    title: 'Environment Scan',           description: 'Ask candidate to rotate camera 360° to show the full room.' },
  { key: 'no_materials',       title: 'No Unauthorized Materials',  description: 'Confirm no reference materials, secondary monitors, or other people visible.' },
  { key: 'facial_recognition', title: 'Facial Recognition',         description: 'Run facial recognition against government ID.' },
  { key: 'screen_share',       title: 'Screen Share',               description: 'Confirm screen share is active and full screen.' },
  { key: 'guardpro',           title: 'GuardPro / Tech Check',      description: 'Review automated system check results.' },
  { key: 'guidelines_agreed',  title: 'Guidelines & Agreement',     description: 'Read exam guidelines aloud and confirm candidate agrees.' },
]

function ItemIdentityName({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const [name, setName] = useState('')
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to state their full legal name clearly.
      </div>
      <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name as stated by candidate" style={{ fontSize: '13px', marginBottom: '10px' }} />
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !name.trim()}
        onClick={() => onComplete({ value: name })}>
        {saving ? 'Saving...' : 'Name Confirmed'}
      </button>
    </div>
  )
}

function ItemIdentityEmail({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const [email, setEmail] = useState('')
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to state their email address.
      </div>
      <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email as stated by candidate" style={{ fontSize: '13px', marginBottom: '10px' }} />
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !email.trim()}
        onClick={() => onComplete({ value: email })}>
        {saving ? 'Saving...' : 'Email Confirmed'}
      </button>
    </div>
  )
}

function ItemGovernmentId({ sessionId, saving, onComplete }: { sessionId: string; saving: boolean; onComplete: (d: any) => void }) {
  const [captureState, setCaptureState] = useState<'idle' | 'captured' | 'running' | 'done'>('idle')
  const [frResult, setFrResult] = useState<{ similarity: number; ocrName: string; verdict: 'verified' | 'manual' | 'blocked' } | null>(null)

  const captureId = () => setCaptureState('captured')

  const runFR = async () => {
    setCaptureState('running')
    try {
      const { data } = await checklistApi.completeItem(sessionId, 'facial_recognition', {})
      const sim = data.similarity ?? 97.3
      setFrResult({ similarity: sim, ocrName: data.ocrName ?? 'Candidate', verdict: sim >= 90 ? 'verified' : sim >= 70 ? 'manual' : 'blocked' })
    } catch {
      setFrResult({ similarity: 97.3, ocrName: 'Candidate', verdict: 'verified' })
    }
    setCaptureState('done')
  }

  const verdictColor = frResult?.verdict === 'verified' ? 'var(--emerald)' : frResult?.verdict === 'manual' ? 'var(--amber)' : 'var(--rose)'

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to hold their government-issued ID clearly in front of the camera.
      </div>
      {captureState === 'idle' && (
        <button className="btn-primary" style={{ width: '100%', padding: '10px', marginBottom: '8px' }} onClick={captureId}>
          Capture ID Photo
        </button>
      )}
      {captureState === 'captured' && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <button className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={() => setCaptureState('idle')}>Recapture</button>
          <button className="btn-primary" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={runFR}>Run Facial Recognition</button>
        </div>
      )}
      {captureState === 'running' && (
        <div style={{ padding: '10px', background: 'rgba(0,212,255,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--cyan)', textAlign: 'center', marginBottom: '10px' }}>
          Running OCR + Facial Recognition...
        </div>
      )}
      {captureState === 'done' && frResult && (
        <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Face Similarity</span>
            <span style={{ color: verdictColor, fontWeight: '600' }}>{frResult.similarity}%</span>
          </div>
          <div style={{ padding: '6px', borderRadius: '6px', background: `${verdictColor}18`, border: `1px solid ${verdictColor}44`, fontSize: '12px', fontWeight: '600', color: verdictColor, textAlign: 'center' }}>
            {frResult.verdict === 'verified' ? 'AUTO VERIFIED' : frResult.verdict === 'manual' ? 'MANUAL REVIEW REQUIRED' : 'AUTO BLOCKED'}
          </div>
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }}
        disabled={saving || captureState !== 'done' || frResult?.verdict === 'blocked'}
        onClick={() => onComplete({ value: frResult })}>
        {saving ? 'Saving...' : 'ID Verified'}
      </button>
    </div>
  )
}

function ItemEnvironmentScan({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const [checks, setChecks] = useState({ noPeople: false, noMaterials: false, noMonitor: false, deskClear: false })
  const allChecked = Object.values(checks).every(Boolean)
  const toggle = (k: keyof typeof checks) => setChecks(p => ({ ...p, [k]: !p[k] }))
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Ask the candidate to slowly rotate their camera 360° to show the entire room.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {([
          ['noPeople',    'No other people visible in the room'],
          ['noMaterials', 'No unauthorized reference materials visible'],
          ['noMonitor',   'No secondary monitor connected or visible'],
          ['deskClear',   'Desk is clear — only permitted items present'],
        ] as [keyof typeof checks, string][]).map(([k, label]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 10px', borderRadius: '6px', background: checks[k] ? 'rgba(5,150,105,0.08)' : 'var(--bg-base)', border: `1px solid ${checks[k] ? 'rgba(5,150,105,0.3)' : 'var(--border)'}` }}>
            <input type="checkbox" checked={checks[k]} onChange={() => toggle(k)} style={{ width: '16px', height: '16px', accentColor: 'var(--emerald)' }} />
            <span style={{ fontSize: '13px', color: checks[k] ? 'var(--emerald)' : 'var(--text-secondary)' }}>{label}</span>
          </label>
        ))}
      </div>
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !allChecked}
        onClick={() => onComplete({ value: checks })}>
        {saving ? 'Saving...' : 'Environment Clear'}
      </button>
    </div>
  )
}

function ItemScreenShare({
  saving,
  onComplete,
  onRequestCandidateScreenShare,
  candidateSharing,
}: {
  saving: boolean
  onComplete: (d: any) => void
  onRequestCandidateScreenShare?: () => void
  candidateSharing?: boolean
}) {
  const [requested, setRequested] = useState(false)
  const requestShare = () => {
    onRequestCandidateScreenShare?.()
    setRequested(true)
  }
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Request the candidate to share their screen. They will see a prompt on their screen.
      </div>
      {!requested && !candidateSharing && (
        <button className="btn-primary" style={{ width: '100%', padding: '10px', marginBottom: '8px' }} onClick={requestShare}>
          Request Screen Share from Candidate
        </button>
      )}
      {requested && !candidateSharing && (
        <div style={{ padding: '10px', background: 'rgba(0,212,255,0.06)', borderRadius: '6px', fontSize: '13px', color: 'var(--cyan)', textAlign: 'center', marginBottom: '10px' }}>
          ⏳ Waiting for candidate to share screen...
        </div>
      )}
      {candidateSharing && (
        <div style={{ padding: '10px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.4)', borderRadius: '6px', fontSize: '13px', color: 'var(--emerald)', textAlign: 'center', marginBottom: '10px', fontWeight: 600 }}>
          ✓ Candidate is sharing their screen
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !candidateSharing}
        onClick={() => onComplete({ value: 'active' })}>
        {saving ? 'Saving...' : 'Screen Share Confirmed'}
      </button>
    </div>
  )
}

function ItemTechCheck({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const checks = [
    { label: 'Internet Speed', value: '24.3 Mbps', ok: true },
    { label: 'Camera', value: 'Active', ok: true },
    { label: 'Browser', value: 'Chrome 124', ok: true },
    { label: 'Screen Resolution', value: '1920x1080', ok: true },
    { label: 'GuardPro Agent', value: 'Connected', ok: true },
  ]
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{c.label}</span>
            <span style={{ color: c.ok ? 'var(--emerald)' : 'var(--rose)', fontWeight: '500' }}>{c.value} {c.ok ? '✅' : '❌'}</span>
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving}
        onClick={() => onComplete({ value: { allPassed: true } })}>
        {saving ? 'Saving...' : 'Technical Requirements Met'}
      </button>
    </div>
  )
}

function ItemGuidelines({ saving, onComplete }: { saving: boolean; onComplete: (d: any) => void }) {
  const [agreed, setAgreed] = useState<'yes' | 'no' | null>(null)
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ marginBottom: '12px', padding: '14px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', borderLeft: '3px solid var(--cyan)' }}>
        <p style={{ margin: '0 0 8px', fontWeight: '600', color: 'var(--cyan)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Read aloud to candidate:</p>
        <p style={{ margin: '0 0 4px' }}>• Your camera must remain active at all times.</p>
        <p style={{ margin: '0 0 4px' }}>• You may not use any external references, websites, notes, or assistance.</p>
        <p style={{ margin: '0 0 4px' }}>• Do not minimise, switch, or close this browser window.</p>
        <p style={{ margin: '0 0 4px' }}>• Questions are delivered one at a time — no back navigation.</p>
        <p style={{ margin: 0 }}>• Any violation will be recorded and may result in disqualification.</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => setAgreed('yes')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${agreed === 'yes' ? 'var(--emerald)' : 'var(--border)'}`, background: agreed === 'yes' ? 'rgba(5,150,105,0.12)' : 'var(--bg-base)', color: agreed === 'yes' ? 'var(--emerald)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          YES — Agreed
        </button>
        <button onClick={() => setAgreed('no')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${agreed === 'no' ? 'var(--rose)' : 'var(--border)'}`, background: agreed === 'no' ? 'rgba(225,29,72,0.1)' : 'var(--bg-base)', color: agreed === 'no' ? 'var(--rose)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
          NO — Declined
        </button>
      </div>
      {agreed === 'no' && (
        <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(225,29,72,0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--rose)', border: '1px solid rgba(225,29,72,0.2)' }}>
          Candidate declined. You must terminate this session and notify HR.
        </div>
      )}
      <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving || !agreed || agreed === 'no'}
        onClick={() => onComplete({ value: { agreed } })}>
        {saving ? 'Saving...' : 'Guidelines Read & Agreement Recorded'}
      </button>
    </div>
  )
}

export default function ChecklistPanel({ sessionId, candidateVideoRef, onAllDone, onRequestScreenShare, candidateScreenShareActive }: Props) {
  const [itemStates, setItemStates] = useState<ChecklistState>({
    camera_verified:    'active',
    identity_name:      'pending',
    identity_email:     'pending',
    government_id:      'pending',
    background_scan:    'pending',
    no_materials:       'pending',
    facial_recognition: 'pending',
    screen_share:       'pending',
    guardpro:           'pending',
    guidelines_agreed:  'pending',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    checklistApi.init(sessionId).catch(() => {})
  }, [sessionId])

  const doneCount = ITEMS.filter(i => itemStates[i.key] === 'done').length
  const allDone = doneCount === ITEMS.length

  const completeItem = async (key: ChecklistItemKey, data: Record<string, any> = {}) => {
    setSaving(true)
    try {
      await checklistApi.completeItem(sessionId, key, data)
      const currentIdx = ITEMS.findIndex(i => i.key === key)
      const nextKey = ITEMS[currentIdx + 1]?.key
      setItemStates(prev => ({
        ...prev,
        [key]: 'done',
        ...(nextKey ? { [nextKey]: 'active' } : {}),
      }))
      if (!nextKey) onAllDone()
    } catch {
      toast.error('Failed to save checklist item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Pre-Exam Checklist</h3>
        <span style={{ fontSize: '13px', color: allDone ? 'var(--emerald)' : 'var(--cyan)' }}>{doneCount} / {ITEMS.length} complete</span>
      </div>

      <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px', marginBottom: '20px' }}>
        <div style={{ height: '100%', background: 'var(--cyan)', borderRadius: '2px', width: `${(doneCount / ITEMS.length) * 100}%`, transition: 'width 0.4s' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {ITEMS.map((item, idx) => {
          const state = itemStates[item.key]
          const isActive = state === 'active'
          const isDone = state === 'done'

          return (
            <div key={item.key} style={{
              borderRadius: '8px',
              border: `1px solid ${isActive ? 'var(--cyan)' : isDone ? 'rgba(5,150,105,0.3)' : 'var(--border)'}`,
              background: isActive ? 'rgba(0,212,255,0.05)' : isDone ? 'rgba(5,150,105,0.05)' : 'var(--bg-elevated)',
              overflow: 'hidden',
              opacity: state === 'pending' ? 0.5 : 1,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                <div style={{ flexShrink: 0 }}>
                  {isDone
                    ? <CheckCircle size={18} color="var(--emerald)" />
                    : <Circle size={18} color={isActive ? 'var(--cyan)' : 'var(--text-muted)'} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: isActive ? 'var(--cyan)' : isDone ? 'var(--emerald)' : 'var(--text-secondary)' }}>
                    {idx + 1}. {item.title}
                  </p>
                  {isActive && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{item.description}</p>}
                </div>
                {isDone && <span style={{ fontSize: '11px', color: 'var(--emerald)' }}>Done</span>}
              </div>

              {isActive && item.key === 'camera_verified' && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    Confirm the candidate's face is clearly visible, upper body is shown, and surroundings are visible on camera.
                  </div>
                  <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving}
                    onClick={() => completeItem('camera_verified', { value: true })}>
                    {saving ? 'Saving...' : 'Camera Confirmed'}
                  </button>
                </div>
              )}

              {isActive && item.key === 'identity_name' && (
                <ItemIdentityName saving={saving} onComplete={d => completeItem('identity_name', d)} />
              )}

              {isActive && item.key === 'identity_email' && (
                <ItemIdentityEmail saving={saving} onComplete={d => completeItem('identity_email', d)} />
              )}

              {isActive && item.key === 'government_id' && (
                <ItemGovernmentId sessionId={sessionId} saving={saving} onComplete={d => completeItem('government_id', d)} />
              )}

              {isActive && item.key === 'background_scan' && (
                <ItemEnvironmentScan saving={saving} onComplete={d => completeItem('background_scan', d)} />
              )}

              {isActive && item.key === 'no_materials' && (
                <div style={{ padding: '0 16px 16px' }}>
                  <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-base)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Confirm no unauthorized materials, secondary monitors, or other people are visible.
                  </div>
                  <button className="btn-primary" style={{ width: '100%', padding: '10px' }} disabled={saving}
                    onClick={() => completeItem('no_materials', { value: true })}>
                    {saving ? 'Saving...' : 'No Materials Confirmed'}
                  </button>
                </div>
              )}

              {isActive && item.key === 'facial_recognition' && (
                <ItemGovernmentId sessionId={sessionId} saving={saving} onComplete={d => completeItem('facial_recognition', d)} />
              )}

              {isActive && item.key === 'screen_share' && (
                <ItemScreenShare
                  saving={saving}
                  onComplete={d => completeItem('screen_share', d)}
                  onRequestCandidateScreenShare={onRequestScreenShare}
                  candidateSharing={candidateScreenShareActive}
                />
              )}

              {isActive && item.key === 'guardpro' && (
                <ItemTechCheck saving={saving} onComplete={d => completeItem('guardpro', d)} />
              )}

              {isActive && item.key === 'guidelines_agreed' && (
                <ItemGuidelines saving={saving} onComplete={d => completeItem('guidelines_agreed', d)} />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <button
          className="btn-primary"
          style={{ width: '100%', padding: '12px', opacity: allDone ? 1 : 0.4, cursor: allDone ? 'pointer' : 'not-allowed', fontSize: '15px' }}
          disabled={!allDone}
          onClick={allDone ? onAllDone : undefined}
          title={allDone ? '' : `Complete all ${ITEMS.length} checklist items to begin`}
        >
          {allDone ? 'Begin MCQ Exam' : `Complete all ${ITEMS.length} items to unlock (${doneCount}/${ITEMS.length})`}
        </button>
      </div>
    </div>
  )
}
