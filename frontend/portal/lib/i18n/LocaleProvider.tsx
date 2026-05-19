'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { MESSAGES, RTL_LOCALES, SUPPORTED_LOCALES, type Locale } from './messages'

// Minimal in-house i18n context. We intentionally avoid next-intl /
// next-i18next for now — they require either route-tree restructuring
// (app/[locale]/...) or a heavy middleware setup, and we don't have
// the translation volume yet to justify that cost. When we do, swap
// this provider for the library equivalent — the useTranslation()
// hook signature is the migration boundary.

type Context = {
  locale: Locale
  setLocale: (loc: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  isRTL: boolean
}

const I18nContext = createContext<Context | null>(null)
const STORAGE_KEY = 'assessexpert.locale'

function pickInitialLocale(): Locale {
  // SSR: stay deterministic — render English on the server, swap on
  // mount via the useEffect below. Hydration mismatch is suppressed
  // by the root layout's suppressHydrationWarning.
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return (SUPPORTED_LOCALES as readonly string[]).includes(browser) ? (browser as Locale) : 'en'
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  // Hydrate from localStorage / navigator language on mount, then
  // re-sync the <html> lang/dir attributes so screen readers and
  // CSS :dir() selectors line up with the active locale.
  useEffect(() => {
    const next = pickInitialLocale()
    setLocaleState(next)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = locale
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    if (!SUPPORTED_LOCALES.includes(next)) return
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next)
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const catalog = MESSAGES[locale] || MESSAGES.en
      // Falling back to en (rather than the raw key) keeps the UI
      // intelligible when a translator hasn't filled in a key yet.
      let value = catalog[key] ?? MESSAGES.en[key]
      if (value === undefined) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] Missing key: ${key}`)
        }
        return key
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return value
    },
    [locale],
  )

  const value = useMemo<Context>(
    () => ({ locale, setLocale, t, isRTL: RTL_LOCALES.includes(locale) }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation must be used inside <LocaleProvider>')
  return ctx
}
