// Manpower supply role catalogue — frontend side.
//
// Mirrors the roles seeded by backend/prisma/cms-seed/manpower-pages.ts.
// The slug here is the URL segment (e.g. `civil-engineer`); the CMS
// row is stored with a `manpower-` prefix (`manpower-civil-engineer`).
// The prefix is applied when looking up the CMS row and stripped
// everywhere the value is user-visible.
//
// Used by:
//   - /manpower                  index page (this list drives the grid)
//   - /manpower/[role]           generateStaticParams
//   - /md/manpower/[role]        markdown-twin generateStaticParams
//   - sitemap.ts + llms.txt      pre-render URLs even if the CMS lookup fails

export interface ManpowerRoleMeta {
  slug: string
  title: string
  category: 'Engineering' | 'Design' | 'Construction Management'
  shortTagline: string
}

export const MANPOWER_ROLES: ManpowerRoleMeta[] = [
  { slug: 'civil-engineer',      title: 'Civil Engineer',          category: 'Engineering',              shortTagline: 'Site engineering, infrastructure, RC structures' },
  { slug: 'mechanical-engineer', title: 'Mechanical Engineer',     category: 'Engineering',              shortTagline: 'HVAC, plumbing, firefighting, thermal design' },
  { slug: 'electrical-engineer', title: 'Electrical Engineer',     category: 'Engineering',              shortTagline: 'LV/MV distribution, lighting, DEWA submittals' },
  { slug: 'mep-engineer',        title: 'MEP Engineer',            category: 'Engineering',              shortTagline: 'Multi-discipline coordination, clash resolution' },
  { slug: 'structural-engineer', title: 'Structural Engineer',     category: 'Engineering',              shortTagline: 'RC + steel design, seismic, foundations' },
  { slug: 'architect',           title: 'Architect',               category: 'Design',                   shortTagline: 'Concept to CD, authority approvals, tender sets' },
  { slug: 'cad-draftsman',       title: 'CAD Draftsman',           category: 'Design',                   shortTagline: 'AutoCAD 2D across all disciplines, shop drawings' },
  { slug: 'bim-modeller',        title: 'BIM Modeller',            category: 'Design',                   shortTagline: 'Revit models, LOD 300–400, clash detection' },
  { slug: '3d-visualizer',       title: '3D Designer / Visualizer', category: 'Design',                  shortTagline: 'V-Ray, Corona, photoreal architecture + interiors' },
  { slug: 'interior-designer',   title: 'Interior Designer',       category: 'Design',                   shortTagline: 'Space planning, FF&E, joinery detailing' },
  { slug: 'quantity-surveyor',   title: 'Quantity Surveyor',       category: 'Construction Management',  shortTagline: 'BOQs, valuations, FIDIC contract admin' },
  { slug: 'project-manager',     title: 'Project Manager',         category: 'Construction Management',  shortTagline: 'Programme, contractor coordination, delivery' },
] as const

export type ManpowerRoleSlug = (typeof MANPOWER_ROLES)[number]['slug']

export const MANPOWER_ROLE_SLUGS = MANPOWER_ROLES.map((r) => r.slug)

/** DB slug for a role URL segment. Adds the `manpower-` namespace prefix. */
export function toManpowerDbSlug(roleSlug: string): string {
  return `manpower-${roleSlug}`
}

/** Reverse: URL segment from a DB slug. Returns null if the slug is not a manpower slug. */
export function fromManpowerDbSlug(dbSlug: string): string | null {
  return dbSlug.startsWith('manpower-') ? dbSlug.slice('manpower-'.length) : null
}
