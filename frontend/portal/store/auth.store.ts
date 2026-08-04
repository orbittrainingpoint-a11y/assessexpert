import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { decodeJwtExp } from '@/lib/jwt-utils'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  organizationId?: string
  mfaEnabled: boolean
}

// PORTAL_GAPS.md C1 — accessToken + refreshToken are now httpOnly
// cookies set by the backend. The store keeps ONLY the user profile
// (safe to expose to JS) and an `isAuthenticated` flag driven by the
// presence of the user record. `setAuth` still accepts the tokens
// for API compatibility during the migration window but does NOT
// persist them anywhere.
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  // Epoch ms when the access token expires. Populated when the
  // login/MFA/refresh response body still carries the JWT (during
  // the cookie migration window). Consumed by useSessionExpiryWarning
  // to show a "session about to expire" toast a few minutes before.
  // Null when unknown — the warning hook simply won't schedule.
  sessionExpiresAt: number | null
  setAuth: (user: User, accessToken?: string, refreshToken?: string) => void
  setSessionExpiry: (expiresAtMs: number | null) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      sessionExpiresAt: null,
      setAuth: (user, accessToken) => {
        // No token storage. The backend set httpOnly cookies alongside
        // this response; JS can't (and shouldn't) touch them.
        // Best-effort cleanup of any stale keys from the pre-cookie
        // era so migrated users don't carry ghost tokens around.
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
          } catch {}
        }
        // Decode the JWT's `exp` (if present in the response body)
        // so useSessionExpiryWarning can plan a pre-expiry toast.
        const exp = decodeJwtExp(accessToken)
        set({ user, isAuthenticated: true, sessionExpiresAt: exp })
      },
      setSessionExpiry: (expiresAtMs) => set({ sessionExpiresAt: expiresAtMs }),
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('assessexpert-auth')
          } catch {}
        }
        set({ user: null, isAuthenticated: false, sessionExpiresAt: null })
      },
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    {
      name: 'assessexpert-auth',
      // Persist only the user profile + expiry timestamp — never the
      // tokens (those live in httpOnly cookies, invisible to this code).
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionExpiresAt: state.sessionExpiresAt,
      }),
    }
  )
)
