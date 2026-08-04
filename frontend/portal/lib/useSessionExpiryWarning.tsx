'use client'

import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { decodeJwtExp } from './jwt-utils'
import { captureError } from './errors'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'

// Warn WARN_BEFORE_MS before expiry so the user has time to click
// "extend now". 2 minutes is enough for someone mid-form to save + hit
// extend; longer, and the toast becomes noise; shorter, and users on
// slow machines miss it.
const WARN_BEFORE_MS = 2 * 60 * 1000

/**
 * Watches the JWT `exp` claim in the auth store and pops a react-hot-toast
 * warning ~2 minutes before the token expires. The toast carries a one-click
 * "Extend session" button that POSTs /auth/refresh; on success the new
 * expiry is picked up here and stored back so the next warning is scheduled
 * for the new deadline.
 *
 * Mount once in the authenticated portal layout — the shownForRef guard
 * de-dupes multiple mounts against the same deadline.
 */
export function useSessionExpiryWarning() {
  const expiresAt = useAuthStore(s => s.sessionExpiresAt)
  const isAuthed = useAuthStore(s => s.isAuthenticated)
  const setSessionExpiry = useAuthStore(s => s.setSessionExpiry)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shownForRef = useRef<number | null>(null)

  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (!isAuthed || !expiresAt) return

    const now = Date.now()
    const warnAt = expiresAt - WARN_BEFORE_MS
    const msUntilWarn = warnAt - now

    const showToast = () => {
      // De-dupe: don't fire the same-deadline toast twice if the hook
      // re-runs for an unrelated reason (route change, etc.).
      if (shownForRef.current === expiresAt) return
      shownForRef.current = expiresAt || null

      const minsLeft = Math.max(0, Math.ceil(((expiresAt || now) - Date.now()) / 60000))
      toast(
        (t) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>
              {minsLeft > 0
                ? `Session expires in ${minsLeft} min. Extend to keep working?`
                : 'Session is expiring. Extend to keep working?'}
            </span>
            <button
              onClick={async () => {
                toast.dismiss(t.id)
                try {
                  const r = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
                  const exp = decodeJwtExp(r?.data?.accessToken)
                  if (exp) setSessionExpiry(exp)
                  toast.success('Session extended')
                } catch (e) {
                  captureError(e, 'session-expiry-extend')
                  toast.error('Could not extend — please save your work and re-login.')
                }
              }}
              style={{
                background: '#059669', color: '#fff', border: 'none',
                padding: '6px 12px', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Extend now
            </button>
          </div>
        ),
        { duration: WARN_BEFORE_MS, id: `session-expiry-${expiresAt}` },
      )
    }

    // Already inside the warning window — fire immediately.
    if (msUntilWarn <= 0) {
      showToast()
      return
    }

    timerRef.current = setTimeout(showToast, msUntilWarn)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [expiresAt, isAuthed, setSessionExpiry])
}
