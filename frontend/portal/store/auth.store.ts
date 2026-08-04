import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  setAuth: (user: User, accessToken?: string, refreshToken?: string) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (user) => {
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
        set({ user, isAuthenticated: true })
      },
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('assessexpert-auth')
          } catch {}
        }
        set({ user: null, isAuthenticated: false })
      },
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    {
      name: 'assessexpert-auth',
      // Persist only the user profile — never the tokens (they live in
      // httpOnly cookies, invisible to this code).
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
