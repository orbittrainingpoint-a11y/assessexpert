// Shared type for blog post seed entries. Lives in its own file so the
// split blog-posts-XX-YY.ts data files can import it without creating
// circular imports through blog-posts.ts (which combines them).

export interface BlogPostSeed {
  slug: string
  title: string
  excerpt: string
  metaTitle: string
  metaDescription: string
  keywords: string[]
  tags: string[]
  authorName: string
  body: string
}
