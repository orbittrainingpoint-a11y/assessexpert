'use client'
import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type ElementType } from 'react'

// Scroll-reveal wrapper: fades + lifts its children into view once, when
// they enter the viewport. Honors prefers-reduced-motion (renders fully
// visible, no transform). `delay` staggers list items (30-50ms each).
export function Reveal({
  children,
  delay = 0,
  y = 24,
  as: Tag = 'div',
  style,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  as?: ElementType
  style?: CSSProperties
  className?: string
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    if (mq.matches) { setShown(true); return }

    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setShown(true); obs.disconnect(); break }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const motion: CSSProperties = reduced
    ? {}
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : `translateY(${y}px)`,
        transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: 'opacity, transform',
      }

  return <Tag ref={ref} className={className} style={{ ...motion, ...style }}>{children}</Tag>
}
