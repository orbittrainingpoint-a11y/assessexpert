'use client'
import { useEffect, useRef } from 'react'

interface Step {
  num: number
  title: string
  desc: string
  icon: string
}

export function WorkflowTimeline({ steps }: { steps: Step[] }) {
  const stepsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -60px 0px' },
    )
    stepsRef.current.forEach((el) => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="web-workflow">
      <div className="web-workflow-line" />
      {steps.map((step, i) => (
        <div
          key={step.num}
          ref={(el) => { stepsRef.current[i] = el }}
          className="web-workflow-step"
          style={{ transitionDelay: `${i * 100}ms` }}
        >
          <div className="web-workflow-dot">{step.num}</div>
          <div style={{ paddingTop: '12px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '22px' }}>{step.icon}</span>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--web-text)', fontFamily: 'var(--web-serif)' }}>
                {step.title}
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--web-text-secondary)', lineHeight: 1.75, maxWidth: '480px' }}>
              {step.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
