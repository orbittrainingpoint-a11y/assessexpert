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
  // ── Common ──────────────────────────────────────────────────────
  'common.language': 'Language',
  'common.retry': 'Retry',
  'common.continue': 'Continue',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.loading': 'Loading…',
  'common.error': 'Something went wrong',

  // ── Pre-exam tech check page ────────────────────────────────────
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

  // ── Candidate exam flow (PORTAL_GAPS.md M7) ─────────────────────
  // OTP phase
  'exam.otp.title': 'Verify your identity',
  'exam.otp.subtitle': 'Enter the 6-digit code we sent to your email.',
  'exam.otp.email_label': 'Email',
  'exam.otp.code_label': 'Verification code',
  'exam.otp.send_code': 'Send code',
  'exam.otp.resend': 'Resend code',
  'exam.otp.resend_in': 'Resend in {seconds}s',
  'exam.otp.verifying': 'Verifying…',
  'exam.otp.verify_continue': 'Verify & Continue',
  'exam.otp.invalid': 'Invalid or expired code',
  'exam.otp.legal_intro': 'Before continuing, please read and agree to:',
  'exam.otp.legal_terms': 'Terms & Conditions',
  'exam.otp.legal_privacy': 'Privacy Policy',
  'exam.otp.legal_agree': 'I have read and agree to the above.',

  // Camera check phase
  'exam.camera.title': 'Camera & Device Check',
  'exam.camera.row.camera': 'Camera',
  'exam.camera.row.microphone': 'Microphone',
  'exam.camera.row.internet': 'Internet',
  'exam.camera.row.fullscreen': 'Fullscreen',
  'exam.camera.ok.camera': 'Active',
  'exam.camera.ok.microphone': 'Active',
  'exam.camera.ok.internet': 'Connected',
  'exam.camera.ok.fullscreen': 'Supported',
  'exam.camera.fail.camera': 'No signal - check permissions',
  'exam.camera.fail.microphone': 'No signal - check permissions',
  'exam.camera.fail.internet': 'Offline - reconnect and retry',
  'exam.camera.fail.fullscreen': 'Browser does not expose Fullscreen API',
  'exam.camera.problem_prefix': 'Camera problem:',
  'exam.camera.retry_access': 'Retry camera access',
  'exam.camera.enter_waiting_room': 'Enter Waiting Room',
  'exam.camera.reference.preparing': 'Preparing your reference photo…',
  'exam.camera.reference.capturing': 'Capturing your reference photo for ID verification…',
  'exam.camera.reference.saved': '✓ Reference photo saved',
  'exam.camera.reference.present': '✓ Reference photo already on file',
  'exam.camera.reference.failed': 'Could not capture reference photo — your proctor will redo this',
  'exam.camera.perm.denied': 'Permission denied. Click the camera icon in your browser address bar and choose "Allow", then retry.',
  'exam.camera.perm.notfound': 'No camera detected. Plug one in, or open Windows → Settings → Privacy → Camera and enable it, then retry.',
  'exam.camera.perm.busy': 'Camera is in use by another app (Zoom / Teams / Meet / OBS). Close it, then retry.',
  'exam.camera.perm.abort': 'Camera start was interrupted. Retry.',
  'exam.camera.perm.generic': 'Camera unavailable — retry, or restart the browser.',
  'exam.camera.perm.granted': 'Camera access granted — proceeding',

  // Verification / waiting-room phase
  'exam.verification.stale_warning': 'Connection to proctor server is unstable — checklist updates may be delayed. Check your internet and wait a moment.',

  // MCQ phase — status + warnings
  'exam.warn.tab_switch': 'You must not switch browser tabs during the assessment. This event has been recorded.',
  'exam.warn.one_minute_left': '1 minute remaining — please submit your current answer.',
  'exam.offline.title': 'Connection Lost',
  'exam.offline.subtitle': 'Attempting to reconnect… your progress is saved.',
  'exam.fullscreen.title': 'Full Screen Required',
  'exam.fullscreen.subtitle': 'Please return to full screen mode to continue the assessment.',
  'exam.fullscreen.return': 'Return to Full Screen',

  // Practical + Complete phase
  'exam.mcq_complete.title': 'MCQ Complete',
  'exam.mcq_complete.body': 'You have finished the multiple-choice section. Please wait — your proctor will assign the practical task shortly.',
  'exam.complete.title': 'Assessment Complete',
  'exam.complete.body': 'Thank you. Your responses have been recorded and your report is being prepared. You may close this window.',

  // Guidelines modal
  'exam.guidelines.title': 'Exam Guidelines',
  'exam.guidelines.agree': 'I agree — Start Exam',
  'exam.guidelines.decline': 'Decline',
  'exam.guidelines.recorded': 'Agreement recorded — your exam will start shortly',

  // Toasts
  'exam.toast.screen_share_active': 'Screen share active',
  'exam.toast.screen_share_required': 'Screen share required for this assessment',
  'exam.toast.disqualified': 'You have been disqualified from this assessment',
  'exam.toast.fullscreen_failed': 'Fullscreen failed. Please enable manually.',
};

const ar: Catalog = {
  // ── Common ──────────────────────────────────────────────────────
  'common.language': 'اللغة',
  'common.retry': 'إعادة المحاولة',
  'common.continue': 'متابعة',
  'common.cancel': 'إلغاء',
  'common.close': 'إغلاق',
  'common.loading': 'جارٍ التحميل…',
  'common.error': 'حدث خطأ ما',

  // ── Pre-exam tech check page ────────────────────────────────────
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

  // ── Candidate exam flow ─────────────────────────────────────────
  'exam.otp.title': 'تحقق من هويتك',
  'exam.otp.subtitle': 'أدخل الرمز المكوّن من 6 أرقام الذي أرسلناه إلى بريدك الإلكتروني.',
  'exam.otp.email_label': 'البريد الإلكتروني',
  'exam.otp.code_label': 'رمز التحقق',
  'exam.otp.send_code': 'إرسال الرمز',
  'exam.otp.resend': 'إعادة إرسال الرمز',
  'exam.otp.resend_in': 'إعادة الإرسال خلال {seconds} ثانية',
  'exam.otp.verifying': 'جارٍ التحقق…',
  'exam.otp.verify_continue': 'تحقق وتابع',
  'exam.otp.invalid': 'الرمز غير صالح أو منتهي الصلاحية',
  'exam.otp.legal_intro': 'قبل المتابعة، يرجى قراءة والموافقة على:',
  'exam.otp.legal_terms': 'الشروط والأحكام',
  'exam.otp.legal_privacy': 'سياسة الخصوصية',
  'exam.otp.legal_agree': 'لقد قرأت ووافقت على ما ورد أعلاه.',

  'exam.camera.title': 'فحص الكاميرا والأجهزة',
  'exam.camera.row.camera': 'الكاميرا',
  'exam.camera.row.microphone': 'الميكروفون',
  'exam.camera.row.internet': 'الإنترنت',
  'exam.camera.row.fullscreen': 'وضع الشاشة الكاملة',
  'exam.camera.ok.camera': 'نشطة',
  'exam.camera.ok.microphone': 'نشط',
  'exam.camera.ok.internet': 'متصل',
  'exam.camera.ok.fullscreen': 'مدعوم',
  'exam.camera.fail.camera': 'لا توجد إشارة - تحقق من الأذونات',
  'exam.camera.fail.microphone': 'لا توجد إشارة - تحقق من الأذونات',
  'exam.camera.fail.internet': 'غير متصل - أعد الاتصال وحاول مرة أخرى',
  'exam.camera.fail.fullscreen': 'المتصفح لا يدعم وضع الشاشة الكاملة',
  'exam.camera.problem_prefix': 'مشكلة في الكاميرا:',
  'exam.camera.retry_access': 'إعادة محاولة الوصول إلى الكاميرا',
  'exam.camera.enter_waiting_room': 'دخول غرفة الانتظار',
  'exam.camera.reference.preparing': 'جارٍ تحضير صورة المرجعية الخاصة بك…',
  'exam.camera.reference.capturing': 'جارٍ التقاط صورتك المرجعية للتحقق من الهوية…',
  'exam.camera.reference.saved': '✓ تم حفظ الصورة المرجعية',
  'exam.camera.reference.present': '✓ الصورة المرجعية محفوظة مسبقاً',
  'exam.camera.reference.failed': 'تعذّر التقاط الصورة المرجعية — سيقوم المراقب بإعادة المحاولة',
  'exam.camera.perm.denied': 'تم رفض الإذن. اضغط على أيقونة الكاميرا في شريط عنوان المتصفح واختر "السماح"، ثم أعد المحاولة.',
  'exam.camera.perm.notfound': 'لم يتم اكتشاف كاميرا. قم بتوصيل كاميرا، أو افتح إعدادات النظام لتفعيل الكاميرا، ثم أعد المحاولة.',
  'exam.camera.perm.busy': 'الكاميرا مستخدمة من قِبَل تطبيق آخر (Zoom / Teams / Meet / OBS). أغلقه ثم أعد المحاولة.',
  'exam.camera.perm.abort': 'توقف تشغيل الكاميرا. أعد المحاولة.',
  'exam.camera.perm.generic': 'الكاميرا غير متاحة — أعد المحاولة، أو أعد تشغيل المتصفح.',
  'exam.camera.perm.granted': 'تم منح إذن الكاميرا — جارٍ المتابعة',

  'exam.verification.stale_warning': 'الاتصال بخادم المراقب غير مستقر — قد تتأخر تحديثات القائمة. تحقق من الإنترنت وانتظر لحظة.',

  'exam.warn.tab_switch': 'لا يجب تبديل علامات تبويب المتصفح أثناء الاختبار. تم تسجيل هذا الحدث.',
  'exam.warn.one_minute_left': 'دقيقة واحدة متبقية — يرجى إرسال إجابتك الحالية.',
  'exam.offline.title': 'انقطع الاتصال',
  'exam.offline.subtitle': 'جارٍ محاولة إعادة الاتصال… تم حفظ تقدمك.',
  'exam.fullscreen.title': 'وضع الشاشة الكاملة مطلوب',
  'exam.fullscreen.subtitle': 'يرجى العودة إلى وضع الشاشة الكاملة لمتابعة الاختبار.',
  'exam.fullscreen.return': 'العودة إلى الشاشة الكاملة',

  'exam.mcq_complete.title': 'اكتمل قسم الأسئلة',
  'exam.mcq_complete.body': 'لقد أنهيت قسم الاختيار من متعدد. يرجى الانتظار — سيقوم المراقب بتخصيص المهمة العملية قريباً.',
  'exam.complete.title': 'اكتمل الاختبار',
  'exam.complete.body': 'شكراً لك. تم تسجيل إجاباتك ويتم الآن إعداد تقريرك. يمكنك إغلاق هذه النافذة.',

  'exam.guidelines.title': 'إرشادات الاختبار',
  'exam.guidelines.agree': 'موافق — ابدأ الاختبار',
  'exam.guidelines.decline': 'رفض',
  'exam.guidelines.recorded': 'تم تسجيل الموافقة — سيبدأ اختبارك قريباً',

  'exam.toast.screen_share_active': 'مشاركة الشاشة نشطة',
  'exam.toast.screen_share_required': 'مشاركة الشاشة مطلوبة لهذا الاختبار',
  'exam.toast.disqualified': 'تم استبعادك من هذا الاختبار',
  'exam.toast.fullscreen_failed': 'فشل تفعيل وضع الشاشة الكاملة. يرجى تفعيله يدوياً.',
};

export const MESSAGES: Record<Locale, Catalog> = { en, ar };
