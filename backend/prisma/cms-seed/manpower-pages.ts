// Skilled Manpower Supply — role landing pages.
//
// Second service line alongside the Assessment Platform: contract +
// permanent placement of vetted engineering, design, and construction
// professionals into UAE / GCC hiring teams. Every candidate we place
// is technically assessed on our own platform first, so the CV you
// receive already has a verified score attached.
//
// Storage convention: slugs are prefixed `manpower-` in the DB
// (e.g. `manpower-civil-engineer`) so they don't collide with the
// assessment-service namespace. The frontend routes them to
// /manpower/<role> after stripping the prefix. The backend classifier
// in CmsService.listPublicPages() sets kind='manpower' when it sees
// this prefix plus a service-shaped content payload.
//
// Content shape reuses ServicePageSeed (intro / sections / features /
// faqs / cta) so the existing renderer works with zero changes.

import type { ServicePageSeed } from './service-pages'

const MANPOWER_CTA = {
  title: 'Need vetted engineering talent — this week or long-term?',
  subtitle: 'Share the role brief. Within 5 business days we shortlist 3–5 candidates, each with a proctored technical assessment score attached to the CV. Contract, permanent, or project-based placement across the UAE and wider GCC.',
}

interface RoleDef {
  slug: string          // path segment used in the URL (without `manpower-` prefix)
  title: string         // "Civil Engineer"
  category: string      // "Engineering" | "Design" | "Construction Management"
  disciplines: string   // "site engineering, roads, drainage, RC structures"
  tools: string[]       // ["AutoCAD Civil 3D", "Revit", "SAP2000"]
  seniority: string[]   // ["Junior (0–3y)", "Mid (3–7y)", "Senior (7y+)"]
  typicalOutputs: string // "structural drawings, calculation reports, BOQs"
  keywords: string[]
  gccRelevance: string   // one-sentence why-this-market
}

const ROLES: RoleDef[] = [
  {
    slug: 'civil-engineer',
    title: 'Civil Engineer',
    category: 'Engineering',
    disciplines: 'site engineering, roads and infrastructure, drainage, RC structures, quantity take-offs, and coordination with consultants',
    tools: ['AutoCAD Civil 3D', 'Revit', 'STAAD.Pro', 'SAP2000', 'MS Project', 'Primavera P6'],
    seniority: ['Junior (0–3y)', 'Mid (3–7y)', 'Senior (7y+)', 'Lead / Project Engineer'],
    typicalOutputs: 'GA drawings, RC detailing, BOQs, method statements, ITPs, IRs',
    keywords: ['civil engineer dubai', 'civil engineer uae', 'hire civil engineer gcc', 'contract civil engineer', 'civil engineer manpower supply'],
    gccRelevance: 'UAE, KSA, and Qatar mega-projects (NEOM, Expo legacy, FIFA infrastructure) drive persistent civil-engineer demand, especially for Municipality-approved profiles.',
  },
  {
    slug: 'mechanical-engineer',
    title: 'Mechanical Engineer',
    category: 'Engineering',
    disciplines: 'HVAC design, plumbing, firefighting, pumps and pressure systems, thermal calculations, and MEP coordination',
    tools: ['AutoCAD', 'Revit MEP', 'HAP', 'PipeFlow', 'CAESAR II', 'Navisworks'],
    seniority: ['Junior (0–3y)', 'Mid (3–7y)', 'Senior (7y+)', 'Lead Mechanical'],
    typicalOutputs: 'HVAC layouts, load calculations, equipment schedules, technical submittals',
    keywords: ['mechanical engineer dubai', 'HVAC engineer uae', 'plumbing engineer gcc', 'mechanical engineer for hire'],
    gccRelevance: 'District cooling and high-rise HVAC dominate the GCC mechanical workload — hire profiles with local code and DEWA/ADDC/KAHRAMAA submittal experience.',
  },
  {
    slug: 'electrical-engineer',
    title: 'Electrical Engineer',
    category: 'Engineering',
    disciplines: 'LV/MV distribution, lighting, earthing, cable sizing, DEWA/ADDC submittals, and switchgear coordination',
    tools: ['AutoCAD Electrical', 'Revit MEP', 'DIALux', 'ETAP', 'AmTech'],
    seniority: ['Junior (0–3y)', 'Mid (3–7y)', 'Senior (7y+)', 'Lead Electrical / Authority Liaison'],
    typicalOutputs: 'single-line diagrams, load schedules, cable schedules, lighting layouts, authority approval packs',
    keywords: ['electrical engineer dubai', 'electrical engineer uae', 'dewa approval engineer', 'lv electrical engineer gcc'],
    gccRelevance: 'DEWA/ADDC/SEC approval workflows require region-specific expertise; a good LV electrical engineer with local authority experience is a scarce hire.',
  },
  {
    slug: 'mep-engineer',
    title: 'MEP Engineer',
    category: 'Engineering',
    disciplines: 'mechanical + electrical + plumbing coordination, MEP shop drawings, clash resolution, and contractor supervision',
    tools: ['Revit MEP', 'Navisworks', 'AutoCAD', 'BIM 360', 'Bluebeam'],
    seniority: ['Mid (3–7y)', 'Senior (7y+)', 'MEP Coordinator', 'MEP Manager'],
    typicalOutputs: 'coordinated MEP models, clash reports, shop drawings, RFIs',
    keywords: ['mep engineer dubai', 'mep coordinator uae', 'mep manager gcc', 'revit mep engineer hire'],
    gccRelevance: 'GCC contractors expect MEP profiles fluent in both design intent and site execution — the hybrid engineer/coordinator is the most-requested manpower profile in Dubai.',
  },
  {
    slug: 'structural-engineer',
    title: 'Structural Engineer',
    category: 'Engineering',
    disciplines: 'RC and steel design, seismic analysis, foundation systems, post-tensioning, and structural detailing',
    tools: ['ETABS', 'SAP2000', 'STAAD.Pro', 'Revit Structure', 'Tekla Structures', 'RAM Concept'],
    seniority: ['Mid (3–7y)', 'Senior (7y+)', 'Principal Structural Engineer'],
    typicalOutputs: 'calculation reports, GA and detailing drawings, foundation designs, peer-review responses',
    keywords: ['structural engineer dubai', 'structural engineer uae', 'etabs engineer gcc', 'peer review structural'],
    gccRelevance: 'High-rise, cantilever, and seismic-code (UBC/ACI/BS/EC) fluency is table stakes for Gulf structural work — filter aggressively for peer-review experience.',
  },
  {
    slug: 'architect',
    title: 'Architect',
    category: 'Design',
    disciplines: 'concept design, DD/CD packages, authority approvals, tender drawings, and site supervision',
    tools: ['Revit', 'AutoCAD', 'Rhino', 'SketchUp', 'Enscape / Lumion', 'Adobe Suite'],
    seniority: ['Junior Architect', 'Architect (5–8y)', 'Senior Architect', 'Project Architect', 'Design Director'],
    typicalOutputs: 'concept boards, DD/CD sets, authority submittal drawings, tender documentation',
    keywords: ['architect dubai', 'architect uae', 'senior architect gcc', 'project architect for hire'],
    gccRelevance: 'Dubai Municipality / ADM / Trakhees approval workflow familiarity is a decisive filter; European or Australian architects need a coach for their first authority submission.',
  },
  {
    slug: 'cad-draftsman',
    title: 'CAD Draftsman',
    category: 'Design',
    disciplines: 'AutoCAD 2D drafting across architectural, structural, MEP, and civil disciplines; drawing standardisation; and issue management',
    tools: ['AutoCAD', 'Revit (basic)', 'MicroStation', 'Bluebeam', 'PDF markup workflows'],
    seniority: ['Junior Draftsman', 'Mid (3–5y)', 'Senior Draftsman', 'CAD Lead'],
    typicalOutputs: 'shop drawings, as-builts, construction sets, revision tracking',
    keywords: ['autocad draftsman dubai', 'cad draftsman uae', 'shop drawing draftsman gcc', 'draftsman for hire dubai'],
    gccRelevance: 'Contractor-side shop-drawing production is the highest-volume CAD role in the region; strong Filipino, Indian, and Egyptian candidate pipelines with GCC-standard drawing conventions.',
  },
  {
    slug: 'bim-modeller',
    title: 'BIM Modeller',
    category: 'Design',
    disciplines: 'Revit modelling across architecture / structure / MEP, family creation, LOD 300–400 development, and clash detection',
    tools: ['Revit', 'Navisworks', 'Dynamo', 'BIM 360 / ACC', 'Rhino Grasshopper', 'IFC workflows'],
    seniority: ['Junior BIM Modeller', 'BIM Modeller (3–6y)', 'Senior BIM Modeller', 'BIM Coordinator'],
    typicalOutputs: 'federated Revit models, IFC exports, clash reports, family libraries, BEP compliance',
    keywords: ['bim modeller dubai', 'revit modeller uae', 'bim modeller gcc', 'bim coordinator for hire'],
    gccRelevance: 'BIM mandate compliance (Dubai Municipality Circular 196, ADDA/DoT BIM standards) makes proven Revit + BEP fluency a hard requirement on most GCC projects above AED 30M.',
  },
  {
    slug: '3d-visualizer',
    title: '3D Designer / Visualizer',
    category: 'Design',
    disciplines: '3D modelling, texturing, lighting, and photoreal rendering for architecture, interiors, and product presentations',
    tools: ['3ds Max', 'V-Ray', 'Corona', 'Blender', 'Enscape', 'Lumion', 'Twinmotion', 'Photoshop'],
    seniority: ['Junior 3D Artist', '3D Visualizer (3–5y)', 'Senior Visualizer', '3D Team Lead'],
    typicalOutputs: 'photoreal stills, walk-through animations, VR-ready models, marketing renders',
    keywords: ['3d visualizer dubai', '3d artist uae', 'v-ray artist gcc', 'architectural visualizer for hire'],
    gccRelevance: 'Off-plan property marketing runs on renders; developers request V-Ray/Corona artists with a signature style rather than generic Enscape output.',
  },
  {
    slug: 'interior-designer',
    title: 'Interior Designer',
    category: 'Design',
    disciplines: 'space planning, FF&E, joinery detailing, material specification, and finishes coordination',
    tools: ['AutoCAD', 'Revit', 'SketchUp', 'Enscape', '3ds Max', 'Adobe Suite'],
    seniority: ['Junior Interior Designer', 'Interior Designer (3–6y)', 'Senior Interior Designer', 'Design Manager'],
    typicalOutputs: 'concept boards, joinery details, FF&E schedules, sample boards, tender documentation',
    keywords: ['interior designer dubai', 'interior designer uae', 'ffe designer gcc', 'joinery detailer for hire'],
    gccRelevance: 'Retail, hospitality, and residential fit-out projects in Dubai / Riyadh / Doha drive constant demand — hire for material vocabulary matched to project tier.',
  },
  {
    slug: 'quantity-surveyor',
    title: 'Quantity Surveyor',
    category: 'Construction Management',
    disciplines: 'measurement, BOQ preparation, tender evaluation, variation management, interim valuations, and final account closure',
    tools: ['CostX', 'Bluebeam Revu', 'Candy', 'Buildsoft', 'Excel-driven BOQs', 'FIDIC contract awareness'],
    seniority: ['Junior QS', 'QS (3–6y)', 'Senior QS', 'QS Manager / Commercial Manager'],
    typicalOutputs: 'BOQs, tender comparisons, valuations, variation orders, final accounts, cost reports',
    keywords: ['quantity surveyor dubai', 'quantity surveyor uae', 'senior qs gcc', 'commercial manager hire'],
    gccRelevance: 'FIDIC 1999 red/yellow-book fluency and Arabic-English tender document handling are decisive filters — MRICS-qualified profiles command a premium.',
  },
  {
    slug: 'project-manager',
    title: 'Project Manager',
    category: 'Construction Management',
    disciplines: 'programme management, contractor coordination, stakeholder reporting, risk management, and handover',
    tools: ['Primavera P6', 'MS Project', 'Procore', 'Aconex', 'BIM 360', 'Bluebeam'],
    seniority: ['Assistant PM', 'Project Manager (7y+)', 'Senior PM', 'Programme Director'],
    typicalOutputs: 'programmes, risk registers, monthly reports, snag and handover packs, cost/time forecasts',
    keywords: ['project manager dubai construction', 'project manager uae', 'construction pm gcc', 'programme director for hire'],
    gccRelevance: 'PMP + Primavera + client-side authority-liaison experience is the standard baseline; developer/consultant-side PMs in Dubai and Riyadh are in structural short supply.',
  },
]

function makeSeed(role: RoleDef): ServicePageSeed {
  const tools = role.tools.join(', ')
  const seniority = role.seniority.join(', ')
  return {
    slug: `manpower-${role.slug}`,
    title: `${role.title} — Manpower Supply`,
    metaTitle: `Hire ${role.title} in Dubai & GCC | AssessExpert Manpower`,
    metaDescription: `${role.title} manpower supply across the UAE and wider GCC. Contract and permanent placement of pre-assessed ${role.title.toLowerCase()} profiles with verified technical scores.`,
    keywords: role.keywords,
    content: {
      heroBadge: role.category,
      heroTitle: `Hire ${role.title}s —`,
      heroHighlight: 'Pre-Assessed',
      heroSubtitle: `Contract and permanent placement of ${role.title.toLowerCase()} profiles across the UAE and GCC. Every CV you receive already carries a proctored technical assessment score, so shortlists are hours — not weeks.`,
      intro: `${role.title} manpower supply from AssessExpert. We source, technically assess, and place ${role.title.toLowerCase()} profiles into UAE and GCC hiring teams on contract, permanent, or project-outsourced terms. Coverage across ${role.disciplines}. Every shortlisted CV is paired with a verified assessment score taken on our own proctored platform — you interview candidates, not CVs.`,
      sections: [
        {
          title: `What our ${role.title.toLowerCase()} candidates cover`,
          body: `<p>Our active pool of ${role.title.toLowerCase()} profiles works across ${role.disciplines}. Typical output on the desk: ${role.typicalOutputs}.</p><p>Tooling depth is filtered on intake: ${tools}. Candidates who cannot demonstrate live proficiency on the tools listed on their CV do not enter our shortlist.</p>`,
        },
        {
          title: 'Every CV comes with a verified assessment score',
          body: `<p>Manpower agencies send you CVs. We send you CVs and a proctored assessment result taken on the AssessExpert platform — the same platform corporate hiring teams use to vet their own applicants.</p><p>The score is not a self-declaration. It reflects a role-specific MCQ + practical assessment, human-reviewed by a certified proctor, with the integrity signal recorded. If a candidate could not do the work, they do not reach your inbox.</p>`,
        },
        {
          title: 'Contract, permanent, or project-outsourced',
          body: `<p>We support three engagement models:</p><ul><li><strong>Contract staffing</strong> — 3, 6, or 12-month deployments to your site or office, with the professional on our sponsorship (UAE) or yours.</li><li><strong>Permanent placement</strong> — direct hire with a replacement guarantee within the probation period.</li><li><strong>Project outsourcing</strong> — a small team of ${role.title.toLowerCase()}s delivering a defined scope under our supervision, priced on deliverables.</li></ul><p>Which model fits depends on visa status, project duration, and how much day-to-day management you can absorb — we will walk through the trade-off on the intake call.</p>`,
        },
        {
          title: 'GCC market context',
          body: `<p>${role.gccRelevance}</p><p>Availability, salary bands, and typical notice periods shift monthly — we maintain live intelligence on all three and share the current picture as part of the intake call so you go into the requisition with a realistic hiring frame.</p>`,
        },
      ],
      features: [
        { title: 'Pre-assessed candidates only', description: `Every ${role.title.toLowerCase()} in the shortlist has completed a proctored technical assessment on the AssessExpert platform. Score attached to the CV.` },
        { title: 'Seniority coverage', description: `Active profiles across ${seniority}.` },
        { title: 'Tooling-verified', description: `Fluency filtered on: ${tools}.` },
        { title: '5-day shortlist SLA', description: 'From role brief to 3–5 CV shortlist inside 5 business days for standard roles. Faster for hot-list profiles already in our vetted pool.' },
        { title: 'Sponsorship or client-transfer', description: 'Candidates deploy on our UAE sponsorship for contract, or transfer to your entity on permanent — whichever fits the engagement.' },
        { title: 'Replacement guarantee', description: 'For permanent placements, one free replacement if the candidate does not clear probation for performance reasons.' },
      ],
      faqs: [
        { question: `How fast can you supply a ${role.title.toLowerCase()}?`, answer: `For roles that match profiles already in our vetted pool, first CVs land inside 48 hours. For niche requirements we run a fresh assessment cycle and shortlist within 5 business days.` },
        { question: 'Which countries do you cover?', answer: 'Primary coverage: United Arab Emirates, Saudi Arabia, Qatar, Kuwait, Bahrain, and Oman. We also place remote and offshore profiles from India, Pakistan, the Philippines, and Egypt for teams that prefer distributed delivery.' },
        { question: 'How does the assessment work?', answer: `Each candidate takes a role-specific MCQ paper plus a practical task calibrated for a ${role.title.toLowerCase()}. Sessions are AI-proctored and reviewed by a human proctor. The score, integrity signal, and full answer breakdown come attached to the CV.` },
        { question: 'What are the commercial models?', answer: 'Contract staffing is quoted as a monthly rate that includes visa, sponsorship, and payroll. Permanent placement is a percentage of first-year package. Project outsourcing is deliverable-priced.' },
        { question: 'Can you place profiles under our own sponsorship?', answer: 'Yes. For contract engagements over 6 months many clients prefer to transfer sponsorship to their own entity — we support both models and will advise which is cheaper for your specific case.' },
      ],
      ctaTitle: MANPOWER_CTA.title,
      ctaSubtitle: MANPOWER_CTA.subtitle,
    },
  }
}

export const MANPOWER_PAGES: ServicePageSeed[] = ROLES.map(makeSeed)

// Exposed for the frontend's manpower-slugs list. Keep in sync if
// ROLES changes.
export const MANPOWER_ROLE_SLUGS = ROLES.map((r) => r.slug)
