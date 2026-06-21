// Shared JSON-LD schema builders for the marketing site.
//
// Why a shared module: schema is repeated across home, contact,
// about, services, blog. Hand-coding it per page guarantees drift —
// the phone number gets updated in one place and stale in another.
// Centralising means SITE.* is the single source of truth.
//
// We emit Organization + LocalBusiness on every page (Google reads
// per-page) and layer page-specific schema (FAQPage, BlogPosting,
// Service, BreadcrumbList) on top via the page-specific helpers.

import { SITE } from './marketing-content'

// Used as @id everywhere so cross-references resolve to the same
// organisation node. Without a stable @id, search engines treat each
// emission as a separate org and fragment the entity graph.
export const ORG_ID = `${SITE.url}/#organization`
export const LOCALBUSINESS_ID = `${SITE.url}/#localbusiness`
export const WEBSITE_ID = `${SITE.url}/#website`

// Organization schema — the canonical business entity. Linked into
// Article/BlogPosting/Service via publisher/provider references.
export function orgSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.name,
    alternateName: ['assessexpert', 'AssessExpert Dubai'],
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    email: SITE.email,
    telephone: SITE.phone,
    description: SITE.tagline,
    foundingDate: '2024',
    parentOrganization: { '@type': 'Organization', name: SITE.org },
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.addressParts.street,
      addressLocality: SITE.addressParts.locality,
      addressRegion: SITE.addressParts.region,
      addressCountry: SITE.addressParts.country,
    },
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: SITE.email,
      telephone: SITE.phone,
      availableLanguage: ['English', 'Arabic'],
      areaServed: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'IN', 'PK'],
    }],
    sameAs: [
      // Add real social profiles here as they go live. Empty strings
      // are filtered out below to avoid emitting broken sameAs entries.
    ].filter(Boolean),
  }
}

// LocalBusiness — Google rewards local intent (UAE/Dubai searches)
// for businesses with a complete LocalBusiness entry including geo.
export function localBusinessSchema() {
  return {
    '@type': ['LocalBusiness', 'ProfessionalService'],
    '@id': LOCALBUSINESS_ID,
    name: SITE.name,
    url: SITE.url,
    image: `${SITE.url}/og-image.png`,
    logo: `${SITE.url}/logo.png`,
    email: SITE.email,
    telephone: SITE.phone,
    priceRange: '$$$',
    description: SITE.tagline,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.addressParts.street,
      addressLocality: SITE.addressParts.locality,
      addressRegion: SITE.addressParts.region,
      addressCountry: SITE.addressParts.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: SITE.geo.lat,
      longitude: SITE.geo.lng,
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      opens: '09:00',
      closes: '18:00',
    }],
    areaServed: [
      { '@type': 'Country', name: 'United Arab Emirates' },
      { '@type': 'Country', name: 'Saudi Arabia' },
      { '@type': 'Country', name: 'Qatar' },
      { '@type': 'Country', name: 'Kuwait' },
      { '@type': 'Country', name: 'Bahrain' },
      { '@type': 'Country', name: 'Oman' },
    ],
  }
}

// WebSite — enables Google's sitelinks search box, plus gives every
// page a clean parent entity to link to.
export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE.url,
    name: SITE.name,
    description: SITE.tagline,
    publisher: { '@id': ORG_ID },
    inLanguage: ['en', 'ar'],
  }
}

// Bundle Organization + LocalBusiness + WebSite into a single
// `@graph` document — fewer <script> tags, same coverage, and the
// shared @id values make the graph internally consistent.
export function siteGraph(extras: object[] = []) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      orgSchema(),
      localBusinessSchema(),
      websiteSchema(),
      ...extras,
    ],
  }
}

// BreadcrumbList helper. Pass items in order — Home → Section → Page.
// Most pages use a 2- or 3-deep breadcrumb.
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

// FAQPage builder — used by service pages that have their own
// editable FAQ list (the blog detail page extracts from body HTML
// instead via lib/cms.extractFaqsFromBody).
export function faqPageSchema(items: { question: string; answer: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }
}

// Helper for the inline <script type="application/ld+json"> tags.
// Returns the props ready for spread onto a script element so the
// caller doesn't need to remember the type / dangerouslySetInnerHTML
// dance.
export function jsonLdProps(data: object) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  }
}
