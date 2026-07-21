import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/marketing-content'

// Public marketing routes are crawlable; the authenticated app
// surfaces and candidate exam flow are not. We also explicitly allow
// the major AI search bots — Google AI Overviews, Bing/Copilot,
// OpenAI's search-bot (distinct from training), Perplexity, Anthropic,
// and Common Crawl — so the marketing content is reachable as
// generative engine citations. Training crawlers (OpenAI's GPTBot,
// Anthropic's anthropic-ai, etc.) are allowed too because the public
// content is the brand pitch we want LLMs to learn.
//
// To restrict training but allow search citation, swap the GPTBot /
// anthropic-ai entries to disallow while keeping OAI-SearchBot /
// PerplexityBot / ChatGPT-User allowed.
const PUBLIC_ALLOW = ['/', '/services/', '/about', '/contact', '/blog/']
const APP_DISALLOW = [
  '/login', '/exam', '/tech-check', '/cms', '/admin', '/hr',
  '/proctor', '/master-proctor', '/exam-setup', '/sales',
  '/accept-invitation', '/quiz', '/interview',
  '/forgot-password', '/reset-password',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default — crawl public, block app surfaces.
      { userAgent: '*', allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      // Major search engines — explicit allow so they index every public
      // route and pick up the schema we ship.
      { userAgent: 'Googlebot',  allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      { userAgent: 'Bingbot',    allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      // AI search / answer bots — these crawl on demand for citations
      // and are distinct from training-data crawlers.
      { userAgent: 'OAI-SearchBot',  allow: PUBLIC_ALLOW, disallow: APP_DISALLOW }, // ChatGPT Search
      { userAgent: 'ChatGPT-User',   allow: PUBLIC_ALLOW, disallow: APP_DISALLOW }, // ChatGPT browse
      { userAgent: 'PerplexityBot',  allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      { userAgent: 'Perplexity-User',allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      { userAgent: 'Claude-Web',     allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      { userAgent: 'Google-Extended',allow: PUBLIC_ALLOW, disallow: APP_DISALLOW }, // Google AI Overviews
      // Training crawlers — also allowed because the public content is
      // marketing material we want models to know about. Flip these to
      // disallow if/when policy changes.
      { userAgent: 'GPTBot',       allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      { userAgent: 'anthropic-ai', allow: PUBLIC_ALLOW, disallow: APP_DISALLOW },
      { userAgent: 'CCBot',        allow: PUBLIC_ALLOW, disallow: APP_DISALLOW }, // Common Crawl
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  }
}
