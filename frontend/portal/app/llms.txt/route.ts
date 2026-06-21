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

export const dynamic = 'force-static'

export async function GET() {
  const url = SITE.url
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.tagline}. ${SITE.name} is a B2B platform for corporate technical assessment, pre-employment testing, and technical interview evaluation. Built in Dubai by ${SITE.org}, serving the UAE, GCC, and global enterprise hiring teams.`,
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
    '## Priority pages',
    '',
    `- [Homepage](${url}/): platform overview, hero, features, process`,
    `- [Services](${url}/services): all assessment service categories`,
    `- [About](${url}/about): company story, ${SITE.org}`,
    `- [Contact](${url}/contact): sales enquiry, demo request`,
    `- [Blog](${url}/blog): 30 long-form articles on technical hiring`,
    '',
    '## Service landing pages',
    '',
    ...SERVICE_PAGE_SLUGS.map((slug) => `- ${url}/services/${slug}`),
    '',
    '## Topical authority — assessment, hiring, integrity',
    '',
    `${SITE.name} writes about: technical assessment platform design, pre-employment testing software, structured technical interviews, candidate scoring reports, AI-proctored online assessment, anti-cheating measures, AutoCAD / Revit / BIM / coding skill testing, recruitment workflows, custom assessment design, GCC-specific hiring requirements, bilingual Arabic/English assessment delivery.`,
    '',
    '## Discovery surfaces',
    '',
    `- Sitemap: ${url}/sitemap.xml`,
    `- robots.txt: ${url}/robots.txt`,
    `- This file: ${url}/llms.txt`,
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
