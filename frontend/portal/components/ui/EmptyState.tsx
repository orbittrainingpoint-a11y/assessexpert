'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'

// Empty state primitive — replaces the "No results" plain-text state
// on tables and list pages with a designed panel: icon, title,
// one-line explanation, optional CTA button. (PORTAL_GAPS.md M2.)
//
// Use anywhere a query resolved to zero rows. Optional `action` prop
// takes an href (rendered as a Link) OR an onClick + label pair.

interface EmptyStateProps {
  icon?: ReactNode           // any lucide-react icon works nicely at size ~40
  title: string
  description?: string
  action?:
    | { href: string; label: string }
    | { onClick: () => void; label: string }
  compact?: boolean          // true for inline table empty (~180px vs ~280px)
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  const py = compact ? 32 : 56
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: `${py}px 24px`,
        gap: 12,
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--cyan)',
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action && 'href' in action && (
        <Link
          href={action.href}
          className="btn-primary"
          style={{ marginTop: 8, padding: '8px 18px', fontSize: '13px' }}
        >
          {action.label}
        </Link>
      )}
      {action && 'onClick' in action && (
        <button
          onClick={action.onClick}
          className="btn-primary"
          style={{ marginTop: 8, padding: '8px 18px', fontSize: '13px' }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
