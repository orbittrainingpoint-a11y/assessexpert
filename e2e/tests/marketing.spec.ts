import { test, expect } from '@playwright/test'

/**
 * Marketing site smoke — verifies the SEO/AEO work that shipped in
 * earlier commits (30 blog posts, 12 service landing pages, sitemap,
 * schema graph, robots, llms.txt). If any of these fails, the public
 * site's discoverability is broken and search engines will drop
 * rankings on the next crawl.
 *
 * Runs against whichever `BASE_URL` is configured — in CI, point at
 * the production URL for a full smoke; locally, `http://localhost:3000`
 * covers most of the same surface (the CMS seed must have been run).
 */
test.describe('Marketing site', () => {
  test('/blog lists at least one post', async ({ page }) => {
    await page.goto('/blog')
    // Either N post cards render OR the "No articles yet" empty state
    // renders. If the empty state renders it's a fail — the SEO
    // deploy is broken.
    const cards = await page.locator('.web-card').count()
    const empty = await page.getByText(/no articles yet/i).count()
    expect(cards + empty).toBeGreaterThan(0)
    expect(empty).toBe(0)
    expect(cards).toBeGreaterThan(10) // we seeded 30
  })

  test('/services shows the service category grid', async ({ page }) => {
    await page.goto('/services')
    await expect(page.getByText(/service categories/i)).toBeVisible()
  })

  test('a service landing page renders with hero + FAQ', async ({ page }) => {
    await page.goto('/services/technical-assessment-platform')
    await expect(page.getByRole('heading', { name: /technical assessment/i }).first()).toBeVisible()
    await expect(page.getByText(/common questions/i)).toBeVisible()
  })

  test('a blog post renders with content', async ({ page }) => {
    await page.goto('/blog/technical-assessment-platform-guide')
    await expect(page.getByRole('heading', { name: /technical assessment platform/i }).first()).toBeVisible()
  })

  test('/sitemap.xml lists 40+ URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    const urlCount = (body.match(/<url>/g) || []).length
    expect(urlCount).toBeGreaterThan(40) // 5 top + 12 services + 30 blog
  })

  test('/robots.txt allows major search + AI bots', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body.toLowerCase()).toContain('googlebot')
    expect(body.toLowerCase()).toContain('oai-searchbot')
    expect(body.toLowerCase()).toContain('perplexitybot')
    expect(body).toContain('Sitemap:')
  })

  test('/llms.txt is served', async ({ request }) => {
    const res = await request.get('/llms.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body.toLowerCase()).toContain('assessexpert')
    expect(body.toLowerCase()).toContain('contact')
  })

  test('homepage emits Organization + LocalBusiness JSON-LD', async ({ page }) => {
    await page.goto('/')
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(jsonLd).toBeTruthy()
    expect(jsonLd!).toContain('"Organization"')
    expect(jsonLd!).toContain('"LocalBusiness"')
  })

  test('a blog cover image renders', async ({ request }) => {
    const res = await request.get('/blog-cover/technical-assessment-platform-guide.svg')
    expect(res.status()).toBe(200)
    const ct = res.headers()['content-type'] || ''
    expect(ct).toContain('svg')
  })

  test('contact form endpoint accepts a lead', async ({ request }) => {
    const res = await request.post('/api/sales/leads', {
      data: {
        companyName: 'Playwright Test Co',
        fullName: 'Automated Test',
        email: `test-${Date.now()}@example.com`,
        message: 'Automated E2E ping — safe to ignore',
      },
    })
    // 200 or 201 acceptable. 401 means the SalesPublicController
    // split (SAST P2 #15 fix) got undone — regression.
    expect([200, 201]).toContain(res.status())
  })
})
