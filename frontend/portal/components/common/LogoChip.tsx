'use client'
import React from 'react'

/**
 * Renders an uploaded org logo on a small white chip so it reads cleanly
 * against any background (dark portal sidebar, dark candidate quiz/exam
 * page, branded email header). Without this, an opaque white logo
 * appears as a white-on-dark rectangle, and a dark logo with a coloured
 * background clashes with our amber/cyan tones.
 *
 * Sizing is controlled by `height` (pixels). Padding scales so the chip
 * always feels proportional. Pass `inverse` to drop the white background
 * (e.g. when rendering inside an already-light card).
 */
export function LogoChip({
  src,
  alt,
  height = 24,
  inverse = false,
  className,
  style,
}: {
  src: string
  alt?: string
  height?: number
  inverse?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const px = Math.max(2, Math.round(height * 0.18))
  const radius = Math.max(4, Math.round(height * 0.25))
  return (
    <div
      className={className}
      style={{
        background: inverse ? 'transparent' : '#fff',
        padding: inverse ? 0 : `${px}px ${px + 2}px`,
        borderRadius: radius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt || 'Logo'}
        style={{ height, width: 'auto', objectFit: 'contain', display: 'block' }}
      />
    </div>
  )
}
