'use client'
import { Globe } from 'lucide-react'
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n/messages'
import { useTranslation } from '@/lib/i18n/LocaleProvider'

// Single inline dropdown. Reach for the styled select rather than a
// modal/menu because the only state worth surfacing is "which locale
// is active" — anything bigger gets in the way for what is, at most,
// a once-per-session interaction.
export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useTranslation()
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
      <Globe size={14} aria-hidden />
      {!compact && <span>{t('common.language')}</span>}
      <select
        value={locale}
        onChange={e => setLocale(e.target.value as Locale)}
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {SUPPORTED_LOCALES.map(loc => (
          <option key={loc} value={loc}>{LOCALE_LABELS[loc]}</option>
        ))}
      </select>
    </label>
  )
}
