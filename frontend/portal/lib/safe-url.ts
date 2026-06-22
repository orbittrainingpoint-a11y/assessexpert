// SAST P1 #11 — protocol allowlist for hrefs that render values
// coming from the database.
//
// Background: React's JSX escapes text but NOT attribute values for
// known-dangerous protocols. `<a href={x}>` where x is
// `javascript:alert(1)` will navigate and execute. The proctor's
// report page renders `session.practicalSubmissionUrl` as an `<a>`
// href; if that column ever contains a `javascript:` URL (insider
// write, bad migration, future feature that lets external systems
// post submission URLs), every proctor clicking the link would run
// the payload.
//
// Mitigation: only allow http(s) absolute URLs or app-relative paths
// starting with `/`. Anything else is returned as `'#'` and the link
// becomes inert — better than executing untrusted code.
//
// The function is intentionally tiny and dependency-free so it's
// trivial to drop into anywhere a DB-sourced URL is rendered.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

export function safeHref(value: unknown, fallback: string = '#'): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  // App-relative paths are fine — `/uploads/...`, `/blog/...`, etc.
  // Reject `//` (protocol-relative — could become `javascript://` on
  // some parsers) and reject anything before a colon that isn't a
  // recognised protocol.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) return parsed.toString()
  } catch {
    // Fall through — relative URL without a leading slash, or a
    // string `URL` can't parse. Either way, refuse.
  }
  return fallback
}

// Convenience: returns boolean for cases where the caller just wants
// to gate the render entirely (e.g. don't show the link block at all
// rather than rendering an inert one).
export function isSafeHref(value: unknown): boolean {
  return safeHref(value, '') !== ''
}
