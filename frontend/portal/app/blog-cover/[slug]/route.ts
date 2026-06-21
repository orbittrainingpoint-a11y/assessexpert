// Dynamic blog cover image generator.
//
// Serves an SVG image at /blog-cover/<slug>.svg. The slug encodes
// the post category + a short title so each post has a distinct,
// branded cover without us needing to store image files. Category
// drives the colour scheme + icon glyph; title drives the typography.
//
// Why SVG instead of generated bitmaps:
//   - Lightweight (<5KB per cover, no decode cost).
//   - Crisp at any size — works on retina + share previews.
//   - Brand-consistent — colours come from the same palette as the
//     site so every cover reads as part of the system.
//   - Editorial — no AI hallucination, no stock-photo licensing risk.
//
// Caching: served with public, immutable cache for a year — the slug
// is the cache key, change it and you get a fresh image.

import { NextRequest } from 'next/server'

export const dynamic = 'force-static'

// Category catalogue. Each entry drives the colour scheme + the
// single-letter glyph in the corner. The slug → category mapping is
// in COVERS below. New categories: add here + the mapping.
const CATEGORIES: Record<string, { primary: string; accent: string; bg: string; glyph: string; label: string }> = {
  platform:     { primary: '#216dff', accent: '#39d5ff', bg: '#0a1428', glyph: 'P', label: 'Platform' },
  hiring:       { primary: '#10b981', accent: '#34d399', bg: '#0a1f1a', glyph: 'H', label: 'Hiring' },
  software:     { primary: '#8b5cf6', accent: '#a78bfa', bg: '#160c2a', glyph: 'S', label: 'Software' },
  interview:    { primary: '#f59e0b', accent: '#fbbf24', bg: '#251806', glyph: 'I', label: 'Interview' },
  developer:    { primary: '#06b6d4', accent: '#22d3ee', bg: '#0a1c24', glyph: 'D', label: 'Developer' },
  engineering:  { primary: '#ef4444', accent: '#f87171', bg: '#251010', glyph: 'E', label: 'Engineering' },
  cad:          { primary: '#3b82f6', accent: '#60a5fa', bg: '#0a142a', glyph: 'C', label: 'CAD' },
  bim:          { primary: '#a855f7', accent: '#c084fc', bg: '#1a0d29', glyph: 'B', label: 'BIM' },
  reports:      { primary: '#14b8a6', accent: '#2dd4bf', bg: '#0a1f1e', glyph: 'R', label: 'Reports' },
  integrity:    { primary: '#dc2626', accent: '#ef4444', bg: '#1f0a0a', glyph: 'V', label: 'Integrity' },
  workflow:     { primary: '#0ea5e9', accent: '#38bdf8', bg: '#08182a', glyph: 'W', label: 'Workflow' },
  regional:     { primary: '#d97706', accent: '#f59e0b', bg: '#1f1408', glyph: 'U', label: 'UAE / GCC' },
  agency:       { primary: '#e11d48', accent: '#f43f5e', bg: '#1f0a14', glyph: 'A', label: 'Agency' },
}

// Slug → category mapping. Mirrors blog-posts-*.ts slugs.
// New post: add an entry here so it gets a category-tinted cover
// instead of the default platform colour.
const COVERS: Record<string, { category: keyof typeof CATEGORIES; title: string }> = {
  'technical-assessment-platform-guide': { category: 'platform', title: 'Technical Assessment Platform' },
  'how-to-test-candidates-before-hiring': { category: 'hiring', title: 'Test Candidates Before Hiring' },
  'pre-employment-testing-software-guide': { category: 'software', title: 'Pre-Employment Testing Software' },
  'technical-interview-assessment-guide': { category: 'interview', title: 'Technical Interview Assessment' },
  'online-assessment-platform-for-hiring': { category: 'platform', title: 'Online Assessment Platform' },
  'skills-assessment-software-vs-interviews': { category: 'hiring', title: 'Skills Assessment vs Interviews' },
  'reduce-bad-hires-with-assessments': { category: 'hiring', title: 'Reduce Bad Hires' },
  'job-specific-technical-test': { category: 'workflow', title: 'Job-Specific Technical Test' },
  'cv-screening-not-enough-technical-hiring': { category: 'hiring', title: 'Why CV Screening Is Not Enough' },
  'remote-technical-interview-best-practices': { category: 'interview', title: 'Remote Technical Interviews' },
  'candidate-scoring-reports': { category: 'reports', title: 'Candidate Scoring Reports' },
  'custom-online-assessment-tests': { category: 'software', title: 'Custom Assessment Tests' },
  'assess-developers-before-hiring': { category: 'developer', title: 'Assess Developers Before Hiring' },
  'coding-assessment-platform-guide': { category: 'developer', title: 'Coding Assessment Platform' },
  'engineering-candidate-assessment': { category: 'engineering', title: 'Engineering Candidate Assessment' },
  'autocad-assessment-test-for-hiring': { category: 'cad', title: 'AutoCAD Assessment Test' },
  'revit-assessment-test-for-hiring': { category: 'bim', title: 'Revit Assessment Test' },
  'bim-assessment-test': { category: 'bim', title: 'BIM Assessment Test' },
  'assessment-platform-save-time-hr': { category: 'workflow', title: 'Assessment Platforms Save Time' },
  'prevent-cheating-online-hiring-assessments': { category: 'integrity', title: 'Prevent Cheating in Assessments' },
  'technical-skills-assessment-test': { category: 'platform', title: 'Technical Skills Assessment Structure' },
  'assessment-system-for-recruitment-agencies': { category: 'agency', title: 'Assessments for Recruitment Agencies' },
  'rank-candidates-after-technical-test': { category: 'reports', title: 'Rank Candidates After a Test' },
  'outsource-technical-interview-evaluation': { category: 'interview', title: 'Outsource Technical Evaluation' },
  'bulk-hiring-assessment-workflow': { category: 'workflow', title: 'Bulk Hiring Workflow' },
  'job-simulation-tests-hiring': { category: 'workflow', title: 'Job Simulation Tests' },
  'fresh-graduate-assessment-test': { category: 'hiring', title: 'Fresh Graduate Assessments' },
  'technical-testing-improves-performance': { category: 'reports', title: 'Testing Improves Performance' },
  'assessment-platform-uae-gcc': { category: 'regional', title: 'Assessment Platform UAE & GCC' },
  'hire-high-performing-employees': { category: 'platform', title: 'Hire High-Performing Employees' },
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Break a title into 2-3 visual lines for the SVG. We don't measure
// real text width, just split by word count so the title reads
// comfortably in the cover.
function wrapTitle(title: string, maxPerLine = 22): string[] {
  const words = title.split(/\s+/)
  const lines: string[] = []
  let buf = ''
  for (const w of words) {
    if ((buf + ' ' + w).trim().length > maxPerLine) {
      if (buf) lines.push(buf)
      buf = w
    } else {
      buf = (buf ? buf + ' ' : '') + w
    }
  }
  if (buf) lines.push(buf)
  return lines.slice(0, 3)
}

function renderSvg(slug: string): string {
  const meta = COVERS[slug]
  const category = meta?.category || 'platform'
  const titleText = meta?.title || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const c = CATEGORIES[category]

  const lines = wrapTitle(titleText)
  const lineHeight = 70
  const blockHeight = lines.length * lineHeight
  const startY = 320 + (240 - blockHeight) / 2 + lineHeight - 20

  // 1200x630 — Open Graph / Twitter card recommended size. Renders
  // crisp on share previews and large enough for blog hero use.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${escapeXml(titleText)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c.bg}"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${c.primary}"/>
      <stop offset="100%" stop-color="${c.accent}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${c.primary}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${c.primary}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" stroke-width="0.5" opacity="0.4"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <ellipse cx="950" cy="180" rx="380" ry="380" fill="url(#glow)"/>

  <!-- Top brand strip -->
  <rect x="80" y="80" width="120" height="4" fill="url(#accent)" rx="2"/>
  <text x="80" y="130" font-family="'IBM Plex Sans','Inter',system-ui,sans-serif" font-size="18" font-weight="600" fill="${c.primary}" letter-spacing="3">ASSESSEXPERT</text>
  <text x="80" y="158" font-family="'IBM Plex Sans','Inter',system-ui,sans-serif" font-size="14" font-weight="400" fill="#94a3b8" letter-spacing="2">${c.label.toUpperCase()}</text>

  <!-- Glyph card top-right -->
  <g transform="translate(1000,80)">
    <rect width="120" height="120" rx="20" fill="${c.primary}" opacity="0.12"/>
    <rect width="120" height="120" rx="20" fill="none" stroke="${c.primary}" stroke-width="2" opacity="0.4"/>
    <text x="60" y="92" font-family="'IBM Plex Sans',serif" font-size="72" font-weight="700" fill="${c.accent}" text-anchor="middle">${c.glyph}</text>
  </g>

  <!-- Title -->
  ${lines.map((line, i) => `<text x="80" y="${startY + i * lineHeight}" font-family="'IBM Plex Sans','Inter',system-ui,sans-serif" font-size="62" font-weight="700" fill="#f8fafc" letter-spacing="-1">${escapeXml(line)}</text>`).join('\n  ')}

  <!-- Bottom URL -->
  <text x="80" y="580" font-family="'IBM Plex Mono','Menlo',monospace" font-size="16" font-weight="500" fill="#64748b" letter-spacing="1">assessexpert.ae</text>
  <line x1="80" y1="540" x2="200" y2="540" stroke="url(#accent)" stroke-width="2"/>
</svg>`
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const cleanSlug = slug.replace(/\.svg$/, '')
  const svg = renderSvg(cleanSlug)
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // 1 year cache — slug is the cache key. Public so CDN can cache.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export function generateStaticParams() {
  return Object.keys(COVERS).map((slug) => ({ slug: `${slug}.svg` }))
}
