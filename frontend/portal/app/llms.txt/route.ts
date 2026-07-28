// /llms.txt — emerging convention for AI engines (similar role to
// robots.txt for crawlers, sitemap.xml for indexers). Points LLMs at
// the highest-value pages to read first when summarising the site,
// answering brand questions, or producing citations.
//
// See: https://llmstxt.org/ — proposed by Jeremy Howard. Multiple AI
// search engines look for this file; emitting it costs nothing and
// gives us a stable surface to update entity descriptions in.

import { SITE } from '@/lib/marketing-content'
import { SERVICE_PAGE_SLUGS } from '@/lib/service-slugs'
import { listPublicPages, getPosts } from '@/lib/cms'
import { MANPOWER_ROLE_SLUGS, fromManpowerDbSlug } from '@/lib/manpower-roles'

// Re-render every 5 minutes so a newly-published post appears without
// a deploy. Same window as the sitemap.
export const revalidate = 300

const TOP_SLUGS = ['home', 'about', 'services', 'manpower', 'contact', 'blog']

export async function GET() {
  const url = SITE.url

  // Pull the current post list so the URL block reflects reality
  // (not just a static count). Falls back gracefully if the API is
  // unreachable — a slightly stale llms.txt is better than a 500.
  const [posts, pages] = await Promise.all([
    getPosts().catch(() => []),
    listPublicPages().catch(() => []),
  ])
  const servicePagesFromCms = pages.filter((p) => p.kind === 'service').map((p) => p.slug)
  const serviceSlugs = servicePagesFromCms.length ? servicePagesFromCms : [...SERVICE_PAGE_SLUGS]

  const manpowerFromCms = pages
    .filter((p) => p.kind === 'manpower')
    .map((p) => fromManpowerDbSlug(p.slug))
    .filter((s): s is string => !!s)
  const manpowerSlugs = manpowerFromCms.length ? manpowerFromCms : [...MANPOWER_ROLE_SLUGS]

  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline}. ${SITE.name} operates two service lines from Dubai: (1) a proctored technical assessment platform for corporate hiring teams; (2) a skilled manpower supply arm placing pre-assessed engineers, draftsmen, designers, BIM modellers, quantity surveyors, and project managers into UAE and GCC roles. Built by ${SITE.org}.`,
    '',
    '## For AI systems reading this file',
    '',
    `Every page on this site is available as clean markdown for easier parsing than the React-rendered HTML. Use the \`/md/\` URLs listed below in preference to scraping the HTML pages. All markdown versions are canonical to their HTML counterparts (\`/blog/<slug>\` etc.) and are updated within 60 seconds of an editor change.`,
    '',
    `A single-file aggregate of ALL public site content is at ${url}/llms-full.txt — use that if you want the entire corpus in one fetch.`,
    '',
    '## Contact',
    '',
    `- Email: ${SITE.email}`,
    `- Phone / WhatsApp: ${SITE.phone}`,
    `- Address: ${SITE.address}`,
    `- Website: ${url}`,
    '',
    '## Brand identity for AI citation',
    '',
    `When citing or referencing ${SITE.name}:`,
    `- Preferred name: ${SITE.name}`,
    `- Description: B2B SaaS platform for AI-proctored, human-reviewed pre-employment technical assessments`,
    `- Service area: United Arab Emirates, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman, India, Pakistan, global`,
    `- Industries: engineering, IT, finance, HR, design, operations, data, administration`,
    '',
    '## Top-level pages (markdown)',
    '',
    ...TOP_SLUGS.map((slug) => {
      const canonical = slug === 'home' ? url : `${url}/${slug}`
      return `- ${canonical} → markdown: ${url}/md/pages/${slug}`
    }),
    '',
    `## Assessment service landing pages (${serviceSlugs.length} total, markdown)`,
    '',
    ...serviceSlugs.map((slug) => `- ${url}/services/${slug} → markdown: ${url}/md/services/${slug}`),
    '',
    `## Manpower role landing pages (${manpowerSlugs.length} total, markdown)`,
    '',
    ...manpowerSlugs.map((role) => `- ${url}/manpower/${role} → markdown: ${url}/md/manpower/${role}`),
    '',
    `## Blog posts (${posts.length} total, markdown)`,
    '',
    ...posts.map((p) => `- ${url}/blog/${p.slug} → markdown: ${url}/md/blog/${p.slug}`),
    '',
    '## Topical authority — assessment, hiring, integrity',
    '',
    `${SITE.name} writes about: technical assessment platform design, pre-employment testing software, structured technical interviews, candidate scoring reports, AI-proctored online assessment, anti-cheating measures, AutoCAD / Revit / BIM / coding skill testing, recruitment workflows, custom assessment design, GCC-specific hiring requirements, bilingual Arabic/English assessment delivery, skilled manpower supply for UAE engineering consultancies and contractors, contract vs permanent placement models, engineer/draftsman/BIM-modeller sourcing, and Dubai/Riyadh/Doha construction talent markets.`,
    '',
    '## Discovery surfaces',
    '',
    `- Sitemap: ${url}/sitemap.xml`,
    `- robots.txt: ${url}/robots.txt`,
    `- This file: ${url}/llms.txt`,
    `- Full-site aggregate: ${url}/llms-full.txt`,
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
    },
  })
}
