// Seeds the CMS: a dedicated CMS admin user (separate /cms login), the
// editable "home" page row (SEO + hero overrides), and two sample
// published blog posts. Idempotent — safe to re-run.
//
//   npx ts-node prisma/seed-cms.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CMS...');

  // CMS admin — logs in at /cms/login (role gate on CMS routes).
  const org = await prisma.organization.findFirst({ where: { slug: 'assessexpert' } });
  await prisma.user.upsert({
    where: { email: 'cms@assessexpert.ae' },
    update: { role: 'CMS_ADMIN' },
    create: {
      email: 'cms@assessexpert.ae',
      passwordHash: await bcrypt.hash('CmsAdmin@2026!', 10),
      firstName: 'CMS',
      lastName: 'Admin',
      role: 'CMS_ADMIN',
      organizationId: org?.id ?? null,
    },
  });
  console.log('  ✓ CMS admin user: cms@assessexpert.ae / CmsAdmin@2026!');

  // Home page row — SEO + hero copy live in the CMS; section lists fall
  // back to the bundled defaults in the frontend if left empty.
  await prisma.cmsPage.upsert({
    where: { slug: 'home' },
    update: {},
    create: {
      slug: 'home',
      title: 'Home',
      status: 'PUBLISHED',
      metaTitle: 'AssessExpert — AI-Proctored Pre-Employment Assessment Platform',
      metaDescription:
        'Hire with confidence. AssessExpert delivers AI-proctored, proctor-controlled technical assessments with verified, human-reviewed reports across any industry or job role.',
      keywords: ['pre-employment assessment', 'AI proctoring', 'technical assessment', 'candidate screening', 'hiring platform', 'Dubai', 'UAE'],
      content: {
        heroBadge: 'B2B Pre-Employment Assessment Platform',
        heroTitle: 'Hire with Confidence.',
        heroHighlight: 'Assess with Precision.',
        heroSubtitle:
          'assessexpert delivers AI-proctored, proctor-controlled technical assessments — producing verified, human-reviewed reports that give your hiring team the truth about every candidate.',
      },
    },
  });

  // Content and SEO rows for every other public route.
  for (const [slug, m] of Object.entries({
    about: { title: 'About', metaTitle: 'About AssessExpert - Proctor-First Assessment, Built in Dubai', metaDescription: 'AssessExpert is a global B2B SaaS pre-employment assessment platform by Orbit Training, Dubai. Proctor-first, AI-assisted, and built for verified hiring decisions.', content: { heroBadge: 'Our Story', heroTitle: 'About', heroHighlight: 'assessexpert', heroSubtitle: 'A global B2B SaaS pre-employment assessment platform built by Orbit Training, Dubai. We enable companies to conduct structured, AI-proctored technical assessments.', ctaTitle: 'Want to work with us?', ctaSubtitle: 'All client relationships start with a conversation - no self-signup, no payment page.' } },
    services: { title: 'Services', metaTitle: 'Services - MCQ, Practical, AI Proctoring & Reports | AssessExpert', metaDescription: 'A complete managed assessment service: 500-question MCQ banks, role-specific practical tasks, real-time AI proctoring with facial recognition, and human-reviewed reports.', content: { heroBadge: 'What We Offer', heroTitle: 'Our', heroHighlight: 'Services', heroSubtitle: 'A complete managed assessment service - from candidate scheduling to published report. Every session is proctored and every report is human-reviewed.', ctaTitle: 'Need a custom assessment type?', ctaSubtitle: 'Our Exam Setup team builds assessments to your exact job specification - question bank, practical task, and evaluation rubric.' } },
    contact: { title: 'Contact', metaTitle: 'Contact Sales - Request a Demo | AssessExpert', metaDescription: 'Start the conversation. AssessExpert is a sales-led platform with no self-signup. Request a demo and our team will build a custom assessment plan for your hiring needs.', content: { heroBadge: 'Start the Conversation', heroTitle: "Let's", heroHighlight: 'Talk', heroSubtitle: 'assessexpert is a sales-led platform. Every client relationship starts with a conversation with our team.', introTitle: 'Get in Touch', introSubtitle: 'Our sales team is ready to walk you through the platform and build a custom assessment plan for your hiring needs.', processNote: 'Submit this form, our sales team contacts you within 1 business day, a live demo is scheduled, and your company is onboarded after agreement.' } },
    blog: { title: 'Blog', metaTitle: 'Blog - Hiring, Assessment & Proctoring Insights | AssessExpert', metaDescription: 'Insights on pre-employment assessment, proctoring, candidate integrity, and building a verified hiring pipeline from the AssessExpert team.', content: { heroBadge: 'Insights', heroTitle: 'The', heroHighlight: 'Blog', heroSubtitle: 'Insights on pre-employment assessment, proctoring, candidate integrity, and building a verified hiring pipeline.' } },
  })) {
    await prisma.cmsPage.upsert({
      where: { slug },
      update: {},
      create: { slug, title: m.title, status: 'PUBLISHED', metaTitle: m.metaTitle, metaDescription: m.metaDescription, content: m.content },
    });
  }
  console.log('  CMS pages: home, about, services, contact, blog');

  const posts = [
    {
      slug: 'why-proctor-reviewed-reports-matter',
      title: 'Why Proctor-Reviewed Reports Beat Auto-Scored Tests',
      excerpt: 'Auto-scored assessments are fast but blind to context. Here is why a human proctor reviewing every report changes the quality of your hiring decisions.',
      tags: ['Proctoring', 'Hiring', 'Integrity'],
      authorName: 'AssessExpert Team',
      body: `<p>Most online assessment tools optimise for one thing: speed. A candidate finishes, a number pops out, and a recruiter makes a call. The problem is that a raw score hides as much as it reveals.</p>
<h2>Scores without context mislead</h2>
<p>A 72% on an MCQ test means very different things depending on which questions were missed, whether the candidate rushed the final section, and whether the practical work backed up the theory. AssessExpert pairs every MCQ phase with a role-specific practical task — and a certified proctor reviews both before anything is published.</p>
<h2>The human-in-the-loop difference</h2>
<ul><li>AI flags anomalies — gaze, multiple faces, tab switches.</li><li>A proctor reviews every flag in context before it affects the report.</li><li>No report auto-publishes. A person signs off, every time.</li></ul>
<p>The result is a report your hiring team can actually trust.</p>`,
    },
    {
      slug: 'anatomy-of-a-fair-technical-assessment',
      title: 'The Anatomy of a Fair Technical Assessment',
      excerpt: 'Fairness is a design decision. From shuffled question banks to identical time limits, here is how we keep every assessment defensible.',
      tags: ['Assessment Design', 'Fairness'],
      authorName: 'AssessExpert Team',
      body: `<p>A fair assessment treats every candidate identically while still being hard to game. Those two goals pull in opposite directions — unless you design for both.</p>
<h2>Same rules, different papers</h2>
<p>Every assessment type holds a 500-question bank. Each candidate receives 25 questions, Fisher-Yates shuffled, so no two papers are alike — yet the difficulty mix and time limit are identical for everyone.</p>
<h2>Structure the platform enforces</h2>
<p>The two-phase sequence — 30-minute MCQ, then a 60-minute practical — is enforced by the platform. Candidates can't skip ahead, and proctors can't shortcut the checklist. Fairness becomes the default, not a hope.</p>`,
    },
  ];

  for (const p of posts) {
    await prisma.cmsPost.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        body: p.body,
        tags: p.tags,
        authorName: p.authorName,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        metaDescription: p.excerpt,
      },
    });
  }
  console.log(`  ✓ ${posts.length} sample blog posts`);
  console.log('CMS seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
