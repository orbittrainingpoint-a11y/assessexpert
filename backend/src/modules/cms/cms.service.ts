import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Slugs that map to real marketing routes. The CMS only manages these
// pages — an editor can't invent a slug that has no rendering route.
const PAGE_SLUGS = ['home', 'about', 'services', 'contact', 'blog'] as const;
type PageSlug = (typeof PAGE_SLUGS)[number];
const PAGE_DEFAULTS: Record<PageSlug, { title: string; content: Record<string, string> }> = {
  home: {
    title: 'Home',
    content: {
      heroBadge: 'B2B Pre-Employment Assessment Platform',
      heroTitle: 'Hire with Confidence.',
      heroHighlight: 'Assess with Precision.',
      heroSubtitle: 'assessexpert delivers AI-proctored, proctor-controlled technical assessments that produce verified, human-reviewed reports.',
      ctaTitle: 'Ready to transform your hiring process?',
      ctaSubtitle: 'No self-signup. No payment page. Every client relationship starts with a conversation with our team.',
    },
  },
  about: {
    title: 'About',
    content: {
      heroBadge: 'Our Story',
      heroTitle: 'About',
      heroHighlight: 'assessexpert',
      heroSubtitle: 'A global B2B SaaS pre-employment assessment platform built by Orbit Training, Dubai.',
      ctaTitle: 'Want to work with us?',
      ctaSubtitle: 'All client relationships start with a conversation - no self-signup, no payment page.',
    },
  },
  services: {
    title: 'Services',
    content: {
      heroBadge: 'What We Offer',
      heroTitle: 'Our',
      heroHighlight: 'Services',
      heroSubtitle: 'A complete managed assessment service - from candidate scheduling to published report.',
      ctaTitle: 'Need a custom assessment type?',
      ctaSubtitle: 'Our Exam Setup team builds assessments to your exact job specification.',
    },
  },
  contact: {
    title: 'Contact',
    content: {
      heroBadge: 'Start the Conversation',
      heroTitle: "Let's",
      heroHighlight: 'Talk',
      heroSubtitle: 'Every client relationship starts with a conversation with our team.',
      introTitle: 'Get in Touch',
      introSubtitle: 'Our sales team is ready to build a custom assessment plan for your hiring needs.',
      processNote: 'Submit this form, schedule a demo, and onboard your company after agreement.',
    },
  },
  blog: {
    title: 'Blog',
    content: {
      heroBadge: 'Insights',
      heroTitle: 'The',
      heroHighlight: 'Blog',
      heroSubtitle: 'Insights on assessment, proctoring, integrity, and verified hiring pipelines.',
    },
  },
};

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // ── Pages ──────────────────────────────────────────────────────────

  /** Public read — only PUBLISHED pages are exposed to the marketing site. */
  async getPublicPage(slug: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    return page;
  }

  /**
   * Public list of all PUBLISHED page slugs + last-modified timestamps.
   *
   * Powers the marketing-site sitemap so it's fully data-driven: every
   * CMS page that gets published appears in the sitemap on the next
   * revalidation tick without a code change. Returns minimal fields
   * (slug, updatedAt, title, kind) to keep the response cheap.
   *
   * `kind`: discriminator the frontend uses to route the slug — top-level
   * slugs go to /<slug>, service-page slugs (anything with a service-page
   * content shape) go to /services/<slug>.
   */
  async listPublicPages() {
    const TOP_LEVEL = new Set(['home', 'about', 'services', 'contact', 'blog']);
    const pages = await this.prisma.cmsPage.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, title: true, updatedAt: true, content: true },
    });
    return pages.map((p) => {
      const c = (p.content || {}) as Record<string, unknown>;
      const isService = !TOP_LEVEL.has(p.slug) && typeof c.intro === 'string' && Array.isArray(c.sections);
      return {
        slug: p.slug,
        title: p.title,
        updatedAt: p.updatedAt,
        kind: isService ? ('service' as const) : ('top' as const),
      };
    });
  }

  private async ensureManagedPages() {
    await Promise.all(PAGE_SLUGS.map((slug) => this.prisma.cmsPage.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: PAGE_DEFAULTS[slug].title,
        status: 'PUBLISHED',
        content: PAGE_DEFAULTS[slug].content,
      },
    })));
  }

  /** Admin read — every managed page regardless of status. */
  async listPages() {
    await this.ensureManagedPages();
    return this.prisma.cmsPage.findMany({ orderBy: { slug: 'asc' } });
  }

  async getPage(slug: string) {
    if (PAGE_SLUGS.includes(slug as PageSlug)) await this.ensureManagedPages();
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException(`Page "${slug}" not found`);
    return page;
  }

  async upsertPage(slug: string, body: any, userId?: string) {
    if (!PAGE_SLUGS.includes(slug as PageSlug)) {
      throw new BadRequestException(
        `Unknown page slug "${slug}". Allowed: ${PAGE_SLUGS.join(', ')}`,
      );
    }
    const data = {
      title: typeof body.title === 'string' ? body.title : slug,
      status: body.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      content: body.content ?? {},
      metaTitle: body.metaTitle ?? null,
      metaDescription: body.metaDescription ?? null,
      ogImage: body.ogImage ?? null,
      keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : [],
      updatedBy: userId ?? null,
    } as const;
    return this.prisma.cmsPage.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
  }

  // ── Posts (blog) ───────────────────────────────────────────────────

  /** Public list — published posts, newest first, lightweight fields. */
  listPublicPosts() {
    return this.prisma.cmsPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true, slug: true, title: true, excerpt: true,
        coverImage: true, tags: true, authorName: true, publishedAt: true,
      },
    });
  }

  async getPublicPost(slug: string) {
    const post = await this.prisma.cmsPost.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!post) throw new NotFoundException(`Post "${slug}" not found`);
    return post;
  }

  listPosts() {
    return this.prisma.cmsPost.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  async getPost(id: string) {
    const post = await this.prisma.cmsPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private slugify(s: string) {
    return String(s).toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80) || `post-${Date.now()}`;
  }

  /** Strip <script>/<iframe> and inline event handlers as defence in depth.
   *  The frontend sanitises again with DOMPurify before rendering. */
  private sanitizeHtml(html: string): string {
    if (typeof html !== 'string') return '';
    return html
      .replace(/<\s*(script|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  async createPost(body: any, userId?: string) {
    if (!body?.title) throw new BadRequestException('title is required');
    const slug = this.slugify(body.slug || body.title);
    const exists = await this.prisma.cmsPost.findUnique({ where: { slug } });
    if (exists) throw new BadRequestException(`A post with slug "${slug}" already exists`);
    const status = body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    return this.prisma.cmsPost.create({
      data: {
        slug,
        title: String(body.title),
        excerpt: body.excerpt ?? null,
        body: this.sanitizeHtml(body.body ?? ''),
        coverImage: body.coverImage ?? null,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        status,
        authorName: body.authorName ?? null,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : [],
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        updatedBy: userId ?? null,
      },
    });
  }

  async updatePost(id: string, body: any, userId?: string) {
    const existing = await this.getPost(id);
    const status = body.status ?? existing.status;
    const data: any = {
      title: body.title ?? existing.title,
      excerpt: body.excerpt ?? existing.excerpt,
      body: body.body !== undefined ? this.sanitizeHtml(body.body) : existing.body,
      coverImage: body.coverImage ?? existing.coverImage,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : existing.tags,
      status,
      authorName: body.authorName ?? existing.authorName,
      metaTitle: body.metaTitle ?? existing.metaTitle,
      metaDescription: body.metaDescription ?? existing.metaDescription,
      keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : existing.keywords,
      updatedBy: userId ?? null,
    };
    if (body.slug && body.slug !== existing.slug) {
      const slug = this.slugify(body.slug);
      const clash = await this.prisma.cmsPost.findUnique({ where: { slug } });
      if (clash && clash.id !== id) throw new BadRequestException(`slug "${slug}" already in use`);
      data.slug = slug;
    }
    // Stamp publishedAt the first time a post goes live.
    if (status === 'PUBLISHED' && !existing.publishedAt) data.publishedAt = new Date();
    return this.prisma.cmsPost.update({ where: { id }, data });
  }

  async deletePost(id: string) {
    await this.getPost(id);
    await this.prisma.cmsPost.delete({ where: { id } });
    return { ok: true };
  }

  // ── Media ──────────────────────────────────────────────────────────

  listMedia() {
    return this.prisma.cmsMedia.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  recordMedia(input: { url: string; filename: string; mimeType: string; size: number; alt?: string }, userId?: string) {
    return this.prisma.cmsMedia.create({
      data: {
        url: input.url,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        alt: input.alt ?? null,
        uploadedBy: userId ?? null,
      },
    });
  }

  async deleteMedia(id: string) {
    const media = await this.prisma.cmsMedia.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');
    await this.prisma.cmsMedia.delete({ where: { id } });
    return { ok: true, url: media.url };
  }
}
