// Seeds the CMS with the full marketing content load:
//   - 30 blog posts (from blog-posts.ts)
//   - 12 service pages (from service-pages.ts)
//
// Idempotent — re-running updates existing rows in place rather than
// duplicating. Service pages use their natural slug
// (e.g. `technical-assessment-platform`) — none collide with the
// top-level pages seeded by seed-cms.ts (home, about, services,
// contact, blog).
//
// Run:
//   cd backend && npx ts-node prisma/cms-seed/run.ts
import { PrismaClient } from '@prisma/client'
import { BLOG_POSTS } from './blog-posts'
import { SERVICE_PAGES } from './service-pages'

const prisma = new PrismaClient()

async function seedBlogPosts() {
  let created = 0
  let updated = 0
  // Stagger publishedAt across the past 60 days so the blog index looks
  // editorially natural rather than a single bulk drop.
  const baseDate = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  for (let i = 0; i < BLOG_POSTS.length; i++) {
    const p = BLOG_POSTS[i]
    const publishedAt = new Date(baseDate - (BLOG_POSTS.length - 1 - i) * 2 * dayMs)
    const existing = await prisma.cmsPost.findUnique({ where: { slug: p.slug } })
    const data = {
      title: p.title,
      excerpt: p.excerpt,
      body: p.body,
      tags: p.tags,
      authorName: p.authorName,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      keywords: p.keywords,
      status: 'PUBLISHED' as const,
      publishedAt,
    }
    if (existing) {
      await prisma.cmsPost.update({ where: { slug: p.slug }, data })
      updated++
    } else {
      await prisma.cmsPost.create({ data: { slug: p.slug, ...data } })
      created++
    }
  }
  console.log(`  Blog posts: ${created} created, ${updated} updated (${BLOG_POSTS.length} total)`)
}

async function seedServicePages() {
  let created = 0
  let updated = 0
  for (const sp of SERVICE_PAGES) {
    const slug = sp.slug
    const existing = await prisma.cmsPage.findUnique({ where: { slug } })
    const data = {
      title: sp.title,
      status: 'PUBLISHED' as const,
      content: sp.content as unknown as object,
      metaTitle: sp.metaTitle,
      metaDescription: sp.metaDescription,
      keywords: sp.keywords,
    }
    if (existing) {
      await prisma.cmsPage.update({ where: { slug }, data })
      updated++
    } else {
      await prisma.cmsPage.create({ data: { slug, ...data } })
      created++
    }
  }
  console.log(`  Service pages: ${created} created, ${updated} updated (${SERVICE_PAGES.length} total)`)
}

async function main() {
  console.log('Seeding marketing CMS content...')
  await seedBlogPosts()
  await seedServicePages()
  console.log('Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
