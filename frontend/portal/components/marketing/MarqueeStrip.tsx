'use client'

export function MarqueeStrip({ items }: { items: string[] }) {
  // Duplicate the list so the second half scrolls in seamlessly
  const doubled = [...items, ...items]

  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      {/* Fade edges */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '80px', background: 'linear-gradient(90deg, var(--web-bg), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px', background: 'linear-gradient(270deg, var(--web-bg), transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div className="web-marquee-track">
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '12px',
              padding: '0 40px', whiteSpace: 'nowrap',
              fontSize: '14px', fontWeight: 500, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: 'var(--web-text-muted)',
              fontFamily: 'var(--web-sans)',
            }}
          >
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--web-gold)', opacity: 0.5 }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
