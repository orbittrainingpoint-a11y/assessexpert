// Default marketing-site content — the source of truth and the render
// fallback. Marketing pages render from these defaults and overlay any
// fields the CMS provides on top (CMS overrides win). Because the
// defaults are bundled, the public site renders fully even if the
// backend/CMS is unreachable — no blank pages, ever.
//
// Icons are STRING KEYS (see components/marketing/icons.tsx) so content
// stays serialisable and free of emoji (per the UI guidelines).

export type IconKey =
  | 'shield' | 'cpu' | 'clipboard' | 'shuffle' | 'bar-chart' | 'building'
  | 'target' | 'lock' | 'handshake' | 'globe' | 'flask' | 'wrench'
  | 'eye' | 'file-text' | 'layers' | 'mail' | 'phone' | 'map-pin' | 'check'

export interface Feature { icon: IconKey; title: string; desc: string; accent: string }
export interface Stat { value: string; label: string; sub: string }
export interface ProcessStep { step: string; title: string; desc: string }
export interface Industry { name: string; roles: string }

export interface HomeContent {
  label: string
  heroBadge: string
  heroTitle: string
  heroHighlight: string
  heroSubtitle: string
  heroBadges: string[]
  stats: Stat[]
  features: Feature[]
  process: ProcessStep[]
  industries: Industry[]
  trust: Feature[]
}

export interface PageMeta {
  metaTitle: string
  metaDescription: string
  keywords: string[]
}

export const SITE = {
  name: 'AssessExpert',
  brand: 'assessexpert',
  tagline: 'AI-Proctored Pre-Employment Assessment Platform',
  url: 'https://assessexpert.ae',
  email: 'hello@assessexpert.ae',
  phone: '+971 50 000 0000',
  location: 'Dubai, United Arab Emirates',
  org: 'Orbit Training',
}

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About Us' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

export const HOME: HomeContent = {
  label: 'B2B Pre-Employment Assessment Platform',
  heroBadge: 'B2B Pre-Employment Assessment Platform',
  heroTitle: 'Hire with Confidence.',
  heroHighlight: 'Assess with Precision.',
  heroSubtitle:
    'assessexpert delivers AI-proctored, proctor-controlled technical assessments — producing verified, human-reviewed reports that give your hiring team the truth about every candidate.',
  heroBadges: ['AI-Proctored', 'Human-Reviewed Reports', 'Multi-Tenant Isolated', 'No Auto-Publish'],
  stats: [
    { value: '500+', label: 'Questions per Assessment', sub: 'Fisher-Yates shuffled' },
    { value: '25', label: 'Questions per Candidate', sub: 'Unique every time' },
    { value: '7-Day', label: 'Recording Retention', sub: 'Auto-purged after' },
    { value: '100%', label: 'Proctor-Reviewed', sub: 'No auto-publish ever' },
  ],
  features: [
    { icon: 'shield', title: 'Proctor-Controlled Sessions', desc: 'Every session begins only after a certified proctor completes a formal pre-exam checklist. No shortcuts, no exceptions.', accent: '#3B82F6' },
    { icon: 'cpu', title: 'AI Proctoring & Facial Recognition', desc: 'Real-time face detection, gaze tracking, tab-switch alerts, and full session screen recording — all reviewed by a human proctor.', accent: '#6D28D9' },
    { icon: 'clipboard', title: 'Two-Phase Exam Engine', desc: '30-minute MCQ screening always precedes a 60-minute practical task. The sequence is enforced by the platform — no skipping.', accent: '#059669' },
    { icon: 'shuffle', title: '500-Question Shuffle', desc: 'Each assessment type holds 500 questions. Every candidate receives 25 randomly shuffled — no two papers are ever alike.', accent: '#D97706' },
    { icon: 'bar-chart', title: 'Full Answer Breakdown Reports', desc: 'Reports show every question asked, the answer given, and whether it was correct — not just a final score.', accent: '#3B82F6' },
    { icon: 'building', title: 'Multi-Tenant & Isolated', desc: 'Each company sees only their own candidates, sessions, and reports. Strict tenant isolation is enforced at every layer.', accent: '#E11D48' },
  ],
  process: [
    { step: '01', title: 'HR Schedules', desc: 'HR uploads candidate list and selects assessment type. Magic link sent automatically.' },
    { step: '02', title: 'Proctor Checks In', desc: 'Certified proctor completes pre-exam checklist — ID verification, camera check, consent.' },
    { step: '03', title: 'MCQ Assessment', desc: 'Candidate answers 25 shuffled questions in 30 minutes. One question at a time, server-side.' },
    { step: '04', title: 'Practical Task', desc: 'Proctor assigns role-specific task. Candidate has 60 minutes to complete and submit.' },
    { step: '05', title: 'AI Report Draft', desc: 'AI generates full report with scores, answer breakdown, integrity score, and recommendation.' },
    { step: '06', title: 'Proctor Reviews & Publishes', desc: 'Proctor reviews AI draft, adds narrative, and publishes. HR receives the final report.' },
  ],
  industries: [
    { name: 'Engineering & Construction', roles: 'AutoCAD, BIM, MEP, Structural, Civil' },
    { name: 'Information Technology', roles: 'Python, JavaScript, Network, Cybersecurity' },
    { name: 'Finance & Accounting', roles: 'Accountant, Financial Analyst, Auditor' },
    { name: 'Human Resources', roles: 'HR Generalist, Talent Acquisition, L&D' },
    { name: 'Operations & Management', roles: 'Project Manager, Operations, Supply Chain' },
    { name: 'Design & Creative', roles: 'UI/UX, Graphic Design, Brand, 3D Visualizer' },
    { name: 'Data & Analytics', roles: 'Data Analyst, BI Analyst, Power BI, SQL' },
    { name: 'Custom Roles', roles: 'Any job role built to your specification' },
  ],
  trust: [
    { icon: 'shield', title: 'Zero Auto-Publish', desc: 'Every report is reviewed and manually published by a certified proctor.', accent: '#3B82F6' },
    { icon: 'lock', title: 'Tenant Isolation', desc: 'Your data is never visible to other companies. Enforced at database level.', accent: '#6D28D9' },
    { icon: 'eye', title: 'Full Session Recording', desc: 'Screen + webcam recorded for every session. Available to HR for 7 days.', accent: '#059669' },
    { icon: 'check', title: 'Verified Results', desc: 'QR-verified reports. Every published report links to a verification page.', accent: '#D97706' },
  ],
}

export const PAGE_META: Record<string, PageMeta> = {
  home: {
    metaTitle: 'AssessExpert — AI-Proctored Pre-Employment Assessment Platform',
    metaDescription:
      'Hire with confidence. AssessExpert delivers AI-proctored, proctor-controlled technical assessments with verified, human-reviewed reports across any industry or job role.',
    keywords: ['pre-employment assessment', 'AI proctoring', 'technical assessment', 'candidate screening', 'proctored exam', 'hiring platform', 'Dubai', 'UAE'],
  },
  services: {
    metaTitle: 'Services — MCQ, Practical, AI Proctoring & Reports | AssessExpert',
    metaDescription:
      'A complete managed assessment service: 500-question MCQ banks, role-specific practical tasks, real-time AI proctoring with facial recognition, and human-reviewed reports.',
    keywords: ['assessment services', 'MCQ test', 'practical assessment', 'AI proctoring', 'facial recognition', 'assessment reports', 'multi-tenant HR portal'],
  },
  about: {
    metaTitle: 'About AssessExpert — Proctor-First Assessment, Built in Dubai',
    metaDescription:
      'AssessExpert is a global B2B SaaS pre-employment assessment platform by Orbit Training, Dubai. Proctor-first, AI-assisted, and built for verified hiring decisions.',
    keywords: ['about assessexpert', 'Orbit Training', 'Dubai assessment platform', 'proctor-first', 'B2B SaaS assessment'],
  },
  contact: {
    metaTitle: 'Contact Sales — Request a Demo | AssessExpert',
    metaDescription:
      'Start the conversation. AssessExpert is a sales-led platform with no self-signup. Request a demo and our team will build a custom assessment plan for your hiring needs.',
    keywords: ['request demo', 'contact assessexpert', 'assessment platform demo', 'enterprise hiring', 'sales contact'],
  },
  blog: {
    metaTitle: 'Blog — Hiring, Assessment & Proctoring Insights | AssessExpert',
    metaDescription:
      'Insights on pre-employment assessment, proctoring, candidate integrity, and building a verified hiring pipeline from the AssessExpert team.',
    keywords: ['hiring blog', 'assessment insights', 'proctoring', 'recruitment', 'candidate screening'],
  },
}
