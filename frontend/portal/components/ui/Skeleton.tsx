'use client'
import type { CSSProperties } from 'react'

// Loading skeleton primitive — a shimmering placeholder sized to match
// the eventual content so the layout doesn't jump when the fetch
// resolves. Replaces the "Loading..." plain-text state on tables and
// list pages (PORTAL_GAPS.md M1).
//
// Uses the existing --bg-elevated / --bg-glass palette so it matches
// the dark portal shell without a new CSS variable.
//
// Two ready-made helpers on top of the base:
//   <SkeletonRow />        — one horizontal band 44px tall (table row)
//   <SkeletonList count/>  — N stacked SkeletonRows with breathing room

interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: CSSProperties
  className?: string
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 6,
  style,
  className,
}: SkeletonProps) {
  return (
    <span
      className={`skeleton-shimmer ${className || ''}`}
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        // Keyframes live in globals.css (see skeleton-shimmer rule)
        // so multiple instances don't stack independent animations.
        ...style,
      }}
      aria-busy="true"
      aria-live="polite"
    />
  )
}

/** One table-row-height skeleton block. Use inside a list to represent
 *  the eventual row layout. */
export function SkeletonRow({ height = 44 }: { height?: number }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <Skeleton height={height} radius={8} />
    </div>
  )
}

/** Stack of N skeleton rows — the workhorse for table loading states. */
export function SkeletonList({ count = 5, rowHeight = 44 }: { count?: number; rowHeight?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} height={rowHeight} />
      ))}
    </div>
  )
}
