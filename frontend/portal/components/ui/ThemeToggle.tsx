'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

// Three-state theme control (PORTAL_GAPS.md L2):
//   - system: follows the OS `prefers-color-scheme` (default)
//   - light:  forces the light palette (data-theme="light" on <html>)
//   - dark:   forces the dark palette (data-theme="dark" on <html>)
//
// Choice persists in localStorage. The no-flash pre-hydration script
// in app/layout.tsx reads this key BEFORE React mounts so the page
// doesn't flash dark → light on first paint for a user with a light
// preference.

type Mode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'assessexpert.theme'

function applyMode(mode: Mode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (mode === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('system')

  useEffect(() => {
    const stored = (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as Mode | null
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setMode(stored)
    }
  }, [])

  const change = (next: Mode) => {
    setMode(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    applyMode(next)
  }

  const btn = (m: Mode, Icon: typeof Sun, label: string) => (
    <button
      onClick={() => change(m)}
      aria-label={label}
      aria-pressed={mode === m}
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 6,
        background: mode === m ? 'var(--bg-elevated)' : 'transparent',
        border: '1px solid ' + (mode === m ? 'var(--border-accent)' : 'transparent'),
        color: mode === m ? 'var(--cyan)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all var(--t-fast)',
      }}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  )

  return (
    <div role="group" aria-label="Theme" style={{ display: 'inline-flex', gap: 4, padding: 2, background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
      {btn('system', Monitor, 'Follow system theme')}
      {btn('light',  Sun,     'Light theme')}
      {btn('dark',   Moon,    'Dark theme')}
    </div>
  )
}
