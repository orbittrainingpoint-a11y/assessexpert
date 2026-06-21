// Index file — combines the three split blog-posts-XX-YY.ts data files
// into a single BLOG_POSTS array consumed by run.ts.
//
// Split into three files because the long-form content (~1500-1800
// words per post, 30 posts) totals ~250KB. Three 10-post files are
// easier to edit and review than one 6000-line file.

import { BLOG_POSTS_01_10 } from './blog-posts-01-10'
import { BLOG_POSTS_11_20 } from './blog-posts-11-20'
import { BLOG_POSTS_21_30 } from './blog-posts-21-30'

export type { BlogPostSeed } from './blog-posts-types'

export const BLOG_POSTS = [
  ...BLOG_POSTS_01_10,
  ...BLOG_POSTS_11_20,
  ...BLOG_POSTS_21_30,
]
