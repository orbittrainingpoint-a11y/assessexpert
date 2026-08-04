// JWT decode helpers (client-side, no verification).
//
// httpOnly cookies mean JS can no longer read the access token
// directly (PORTAL_GAPS.md C1). We still need the token's `exp` claim
// so we can pre-warn the user before their session dies — the login
// / MFA / refresh responses still include the token in the JSON body
// during the migration window; we decode that once, cache the
// expiry, then just watch a timer.
//
// This does NOT verify the signature. It only extracts a claim so
// the UI can plan around it. Anyone tampering with the payload
// changes only the DISPLAY timer, not access — the server always
// verifies against JWT_SECRET.

/** Decode a JWT and return the `exp` claim in ms since epoch, or null. */
export function decodeJwtExp(token: string | null | undefined): number | null {
  if (!token) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url → base64
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = typeof window === 'undefined'
      ? Buffer.from(padded, 'base64').toString('utf8')
      : atob(padded)
    const payload = JSON.parse(json)
    if (typeof payload?.exp !== 'number') return null
    // JWT `exp` is seconds; return ms so setTimeout math is direct.
    return payload.exp * 1000
  } catch {
    return null
  }
}
