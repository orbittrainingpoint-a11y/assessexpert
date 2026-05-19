// Message catalogues for each supported locale. Keys are
// dot-namespaced; missing keys fall through to the English value at
// runtime so adding a new key to en.ts doesn't immediately break the
// Arabic build — the un-translated string just shows in English with
// a console warning in dev.
//
// To add a new locale: copy `en` to e.g. `fr`, translate the values,
// add the locale code to SUPPORTED_LOCALES below, and (optionally)
// add an entry to LOCALE_LABELS for the switcher dropdown.

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// Locales whose script reads right-to-left. The root <html> dir attr
// is flipped to "rtl" when one of these is active so the layout
// mirrors automatically without per-component changes.
export const RTL_LOCALES: Locale[] = ['ar'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

// Each locale is a flat dot-key map. We considered nested objects but
// flat keys play nicer with the `useTranslation` hook signature (one
// string lookup vs. recursive object traversal) and with future
// extraction tools that expect a key list.
type Catalog = Record<string, string>;

const en: Catalog = {
  // Pre-exam tech check page
  'tech_check.title': 'Pre-Exam Tech Check',
  'tech_check.subtitle': "Run this on the same computer and browser you'll use for your assessment. Nothing leaves your browser — these checks are entirely local.",
  'tech_check.run_all': 'Run All Checks',
  'tech_check.run_all_busy': 'Running…',
  'tech_check.test_screen_share': 'Test Screen Share',
  'tech_check.row.browser': 'Browser',
  'tech_check.row.camera': 'Camera',
  'tech_check.row.microphone': 'Microphone',
  'tech_check.row.screen_share': 'Screen share',
  'tech_check.row.network': 'Network',
  'tech_check.btn.run': 'Run',
  'tech_check.btn.retry': 'Retry',
  'tech_check.all_passed': "✓ All checks passed — you're ready for the exam.",
  'tech_check.next_step': 'When your appointment time arrives, click the magic link in your invitation email to start.',

  // Common UI
  'common.language': 'Language',
};

const ar: Catalog = {
  'tech_check.title': 'فحص الجاهزية التقنية قبل الاختبار',
  'tech_check.subtitle': 'قم بتشغيل هذا الفحص على نفس الجهاز والمتصفح اللذين ستستخدمهما لاجتياز الاختبار. لا تغادر أي بيانات متصفحك — هذه الفحوصات محلية بالكامل.',
  'tech_check.run_all': 'تشغيل جميع الفحوصات',
  'tech_check.run_all_busy': 'جارٍ التشغيل…',
  'tech_check.test_screen_share': 'اختبار مشاركة الشاشة',
  'tech_check.row.browser': 'المتصفح',
  'tech_check.row.camera': 'الكاميرا',
  'tech_check.row.microphone': 'الميكروفون',
  'tech_check.row.screen_share': 'مشاركة الشاشة',
  'tech_check.row.network': 'الشبكة',
  'tech_check.btn.run': 'تشغيل',
  'tech_check.btn.retry': 'إعادة المحاولة',
  'tech_check.all_passed': '✓ اكتملت جميع الفحوصات — أنت جاهز للاختبار.',
  'tech_check.next_step': 'عند حلول موعد جلستك، اضغط على الرابط الموجود في رسالة الدعوة لبدء الاختبار.',

  'common.language': 'اللغة',
};

export const MESSAGES: Record<Locale, Catalog> = { en, ar };
