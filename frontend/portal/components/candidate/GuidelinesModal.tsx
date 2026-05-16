'use client'
import { useState } from 'react'
import { Shield, AlertTriangle, X } from 'lucide-react'

interface Props {
  examTitle?: string
  candidateName?: string
  onAgree: () => void
  onDecline: () => void
}

const RULES: { icon: string; title: string; body: string }[] = [
  { icon: '📹', title: 'Camera must stay on',     body: 'Your camera and microphone must remain active for the entire exam. Covering, switching off, or leaving the camera view is a violation.' },
  { icon: '🖥️', title: 'Entire screen will be shared', body: 'You must share your ENTIRE SCREEN — not a single tab or window. The proctor will watch for any unauthorised activity.' },
  { icon: '🚫', title: 'No outside help',          body: 'No second monitors, phones, notes, websites, AI tools, or other people in the room. Violations may disqualify you.' },
  { icon: '⏱️', title: 'One-way questions',        body: 'Questions are delivered one at a time. There is no back navigation. The timer is strict — submit before it expires.' },
  { icon: '🪟', title: 'Do not leave this window', body: 'Do not minimise, switch tabs, open new windows, or exit fullscreen. Each switch is logged and reported to the proctor.' },
  { icon: '⚠️', title: 'Recording in progress',    body: 'Your video, audio, screen, and on-screen activity are recorded and stored as evidence. Any incident may be reviewed.' },
]

export default function GuidelinesModal({ examTitle, candidateName, onAgree, onDecline }: Props) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setScrolledToEnd(true)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backdropFilter: 'blur(4px)',
    }}>
      <div className="glass-card" style={{
        width: '100%', maxWidth: '620px', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(5,150,105,0.04))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <Shield size={22} color="var(--cyan)" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Exam Guidelines & Agreement
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            {candidateName ? `${candidateName} · ` : ''}{examTitle || 'Please read and accept before starting'}
          </p>
        </div>

        {/* Scrollable rules */}
        <div onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
            This is a <strong style={{ color: 'var(--cyan)' }}>proctored, recorded assessment.</strong>{' '}
            By continuing, you agree to follow every rule below. Violations may result in your session being
            <strong style={{ color: 'var(--rose)' }}> paused, terminated, or disqualified.</strong>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {RULES.map((r, i) => (
              <div key={i} style={{
                display: 'flex', gap: '12px', padding: '12px 14px',
                background: 'var(--bg-elevated)', borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1 }}>{r.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {r.title}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {r.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: '18px', padding: '12px 14px',
            background: 'rgba(225,29,72,0.06)', borderRadius: '8px',
            border: '1px solid rgba(225,29,72,0.2)',
          }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--rose)', lineHeight: '1.6' }}>
              <strong>By clicking "I Agree"</strong> you confirm you have read and understood every rule above,
              and you consent to the recording of your video, audio, and screen for the full duration of this exam.
            </p>
          </div>

          {!scrolledToEnd && (
            <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--amber)', textAlign: 'center', fontStyle: 'italic' }}>
              ↓ Scroll to the bottom to enable agreement
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 24px', background: 'var(--bg-base)' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: scrolledToEnd ? 'pointer' : 'not-allowed',
            opacity: scrolledToEnd ? 1 : 0.5,
            marginBottom: '12px',
          }}>
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={!scrolledToEnd}
              onChange={e => setAcknowledged(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--emerald)' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              I have read, understood, and agree to follow all the rules above.
            </span>
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowDeclineConfirm(true)}
              style={{
                flex: 1, padding: '11px', borderRadius: '8px',
                border: '1px solid rgba(225,29,72,0.4)', background: 'transparent',
                color: 'var(--rose)', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}>
              Decline & Exit
            </button>
            <button
              onClick={onAgree}
              disabled={!acknowledged}
              className="btn-primary"
              style={{ flex: 2, padding: '11px', fontSize: '14px', opacity: acknowledged ? 1 : 0.4, cursor: acknowledged ? 'pointer' : 'not-allowed' }}>
              I Agree — Start My Exam
            </button>
          </div>
        </div>
      </div>

      {/* Decline confirmation */}
      {showDeclineConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div className="glass-card" style={{ maxWidth: '420px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={20} color="var(--rose)" />
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)' }}>Decline & exit the exam?</h3>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              If you decline, your session will be marked as <strong>NOT ATTEMPTED</strong> and reported to HR.
              You will not be able to retake this exam without authorisation.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-ghost" onClick={() => setShowDeclineConfirm(false)} style={{ flex: 1 }}>
                Go Back
              </button>
              <button
                onClick={onDecline}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: '1px solid var(--rose)', background: 'var(--rose)',
                  color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                }}>
                Yes, Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
