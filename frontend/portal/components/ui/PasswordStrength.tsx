'use client'

// Lightweight password strength meter — no zxcvbn dependency to keep
// the bundle small on public reset/invitation flows that don't need
// the full authenticated portal chunks. Signals four buckets that map
// to a coloured 4-bar meter and a short label.
//
// This is a UX aid, not a security control — the backend still enforces
// its own minimum policy on submit. If the meter and the server ever
// disagree, the server wins.  (PORTAL_GAPS.md M8.)

interface Props {
  password: string
  // Optional email so we can dock the score for the "password ==
  // email" mistake that even careful users make.
  email?: string
  // Hide the meter entirely when the password field is empty. Default
  // true — a bare "very weak" meter next to an empty box is noise.
  hideWhenEmpty?: boolean
}

interface Score {
  bucket: 0 | 1 | 2 | 3 | 4     // 0 = too short, 4 = strong
  label: string
  color: string
  hints: string[]                // things the user could add to improve
}

// A tiny inline blocklist — top-30 or so passwords by real-world
// breach frequency. Not a full check (we don't ship 100k rows to the
// client). Covers the "password", "qwerty123" class of mistake.
const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssw0rd',
  'qwerty', 'qwerty123', '1q2w3e4r', 'asdfghjk', 'letmein',
  '123456', '12345678', '123456789', 'iloveyou', 'admin', 'admin123',
  'welcome', 'welcome1', 'monkey', 'football', 'dragon', 'master',
  'sunshine', 'baseball', 'shadow', 'trustno1', 'assessexpert',
  'orbit', 'orbit123', 'dubai', 'dubai123',
])

export function scorePassword(password: string, email?: string): Score {
  const p = password || ''
  const len = p.length

  if (len === 0) {
    return { bucket: 0, label: '', color: 'transparent', hints: [] }
  }
  if (len < 8) {
    return { bucket: 0, label: 'Too short', color: 'var(--rose)', hints: ['At least 8 characters'] }
  }

  const lower = /[a-z]/.test(p)
  const upper = /[A-Z]/.test(p)
  const digit = /[0-9]/.test(p)
  const symbol = /[^A-Za-z0-9]/.test(p)
  const classes = [lower, upper, digit, symbol].filter(Boolean).length

  const hints: string[] = []
  if (!upper) hints.push('an uppercase letter')
  if (!lower) hints.push('a lowercase letter')
  if (!digit) hints.push('a digit')
  if (!symbol) hints.push('a symbol')
  if (len < 12) hints.push('12+ characters')

  const lowered = p.toLowerCase()
  const isCommon = COMMON.has(lowered)
  const matchesEmail = !!email && lowered === email.toLowerCase().split('@')[0]
  const containsEmailUser = !!email && email.length > 3 && lowered.includes(email.toLowerCase().split('@')[0])

  if (isCommon || matchesEmail) {
    return {
      bucket: 1,
      label: 'Very weak (breached / obvious)',
      color: 'var(--rose)',
      hints: ['Choose something unrelated to your email or common words'],
    }
  }

  // Score: length gives 0-3, character classes give 0-3, cap at 4.
  let raw = 0
  if (len >= 8)  raw += 1
  if (len >= 12) raw += 1
  if (len >= 16) raw += 1
  raw += Math.max(0, classes - 2)   // 3 classes = +1, 4 classes = +2

  // Penalise if the local-part of the email is embedded.
  if (containsEmailUser) raw = Math.max(1, raw - 2)

  const bucket = Math.min(4, Math.max(1, raw)) as 1 | 2 | 3 | 4
  const meta = {
    1: { label: 'Weak', color: 'var(--rose)' },
    2: { label: 'Fair', color: 'var(--amber)' },
    3: { label: 'Strong', color: 'var(--cyan)' },
    4: { label: 'Very strong', color: 'var(--emerald)' },
  } as const

  return { bucket, label: meta[bucket].label, color: meta[bucket].color, hints }
}

export function PasswordStrength({ password, email, hideWhenEmpty = true }: Props) {
  if (hideWhenEmpty && !password) return null
  const s = scorePassword(password, email)
  if (s.bucket === 0 && !password) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}
    >
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: i <= s.bucket ? s.color : 'var(--bg-elevated)',
              transition: 'background 200ms ease',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
        {s.hints.length > 0 && (
          <span style={{ color: 'var(--text-muted)' }}>
            Add: {s.hints.slice(0, 3).join(', ')}
          </span>
        )}
      </div>
    </div>
  )
}
