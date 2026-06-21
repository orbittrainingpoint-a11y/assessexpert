// Source of truth for the dynamic /services/[slug] routes.
//
// Mirrors the slugs seeded by backend/prisma/cms-seed/service-pages.ts.
// Used by the sitemap and by generateStaticParams so each page is
// statically generated at build time and revalidated on the ISR window.
//
// Keep this list in sync if you add or remove service pages in the
// seeder. Slug only — title and content live in the CMS.

export const SERVICE_PAGE_SLUGS = [
  'technical-assessment-platform',
  'pre-employment-testing-software',
  'technical-interview-assessment',
  'online-assessment-platform',
  'corporate-assessment-system',
  'custom-assessment-tests',
  'coding-assessment-platform',
  'cad-bim-engineering-assessments',
  'candidate-reports-scoring',
  'recruitment-agency-assessment-platform',
  'technical-testing-for-applicants',
  'assessment-platform-uae',
] as const

export type ServicePageSlug = (typeof SERVICE_PAGE_SLUGS)[number]
