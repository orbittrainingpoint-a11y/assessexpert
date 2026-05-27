'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface AccordionItem {
  q: string
  a: string
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((item, i) => (
        <div key={i} className="web-accordion-item" data-open={openIndex === i ? 'true' : 'false'}>
          <button
            className="web-accordion-trigger"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span>{item.q}</span>
            <ChevronDown size={20} className="web-accordion-chevron" />
          </button>
          <div className="web-accordion-body">
            <p style={{ margin: 0, fontSize: '15px', color: 'var(--web-text-secondary)', lineHeight: 1.75 }}>
              {item.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
