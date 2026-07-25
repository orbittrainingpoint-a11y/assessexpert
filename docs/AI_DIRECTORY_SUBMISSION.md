# Getting AssessExpert listed on AI answer engines

This is a runbook — one-time and periodic actions to maximise the odds
of AssessExpert being cited by ChatGPT, Claude, Perplexity, Gemini, and
the AI-Overviews layer of Google/Bing.

There is **no submission form** for most AI systems. Placement comes
from three overlapping mechanisms:

1. Being crawlable + parseable by their bots (site-side; we control).
2. Being cited by content those bots have already ingested (off-site).
3. For a handful of engines: a real submission form (below).

This doc covers all three.

---

## 1. What we shipped site-side (done — verify after each deploy)

| Surface | URL | Purpose |
|---|---|---|
| Machine index | `/llms.txt` | llmstxt.org convention. Points AI systems at brand identity + priority URLs. |
| Full corpus | `/llms-full.txt` | Concatenated markdown of every page + service + post. Single-fetch site dump. |
| Markdown per page | `/md/pages/<slug>` | Canonical markdown for top-level routes. |
| Markdown per service | `/md/services/<slug>` | Canonical markdown for service landing pages. |
| Markdown per post | `/md/blog/<slug>` | Canonical markdown for blog posts. |
| Content negotiation | HTML routes with `Accept: text/markdown` | Server rewrites to `/md/*` transparently (via `frontend/portal/proxy.ts`). |
| Sitemap | `/sitemap.xml` | Includes every service + post slug. |
| robots.txt | `/robots.txt` | Explicit allow for major AI bots. |
| JSON-LD | Every page `<head>` | Organization + LocalBusiness + WebSite `@graph`. |

**Verify checklist after each deploy:**

```bash
# All should return 200 + expected content-type
curl -sI https://assessexpert.com/llms.txt        | head -5
curl -sI https://assessexpert.com/llms-full.txt   | head -5
curl -sI https://assessexpert.com/md/pages/home   | head -5
curl -sI https://assessexpert.com/md/services/autocad-assessment | head -5
curl -sI https://assessexpert.com/md/blog/<any-slug> | head -5
# Content negotiation on the human URL
curl -sI -H 'Accept: text/markdown' https://assessexpert.com/blog/<any-slug> | head -5
```

Then spot-check a page renders in markdown (`curl` without `-I`).

---

## 2. Search-console-style submissions (do once, then re-submit sitemap on major changes)

These are the closest thing to a "submit" flow. Each one takes 5–15 min
if the domain isn't already verified.

### Google Search Console — required
- https://search.google.com/search-console
- Add property (Domain, not URL-prefix — covers www + subdomains).
- Verify via DNS TXT record (Cloudflare → assessexpert.com DNS).
- Sitemaps → submit `https://assessexpert.com/sitemap.xml`.
- Once indexed, **Search Console → Settings → Crawl stats** shows Googlebot activity. Google-Extended (AI Overviews) uses the same crawl.

### Bing Webmaster Tools — required
- https://www.bing.com/webmasters
- Import from Google Search Console (saves re-verifying).
- Submit sitemap.
- Bing's crawl powers ChatGPT Search, Copilot, and DuckDuckGo AI answers.

### IndexNow — required (Bing + Yandex + others)
- One-off: generate an IndexNow key at https://www.indexnow.org/, upload it as a file at `https://assessexpert.com/<key>.txt`.
- Then on every publish, POST to `https://api.indexnow.org/indexnow` with the changed URL. Bing indexes within minutes rather than days.
- Backend integration point: `backend/src/cms/pages/pages.service.ts` `publish()` action.

### Yandex Webmaster — optional (GCC/Middle East low priority)
- Only worth the time if we see traffic from Russia. Skip for now.

### Naver (Korea) / Baidu (China) — skip
- We don't serve those markets.

---

## 3. AI-specific submission surfaces

Most AI systems do NOT have a submission form. The exceptions:

### OpenAI — no submission
- ChatGPT with browsing uses Bing. Getting into Bing = getting into ChatGPT Search.
- GPTBot (training) will crawl if `robots.txt` allows (it does).
- **Action**: none beyond Bing + robots.

### Anthropic (Claude) — no submission
- `Claude-Web` and `anthropic-ai` are the crawlers. Both allowed in our `robots.txt`.
- Claude does not have a public URL-submission API.
- **Action**: none — being crawlable + linked-to is the entire game.

### Perplexity — no submission, but Discover/publish helps
- `PerplexityBot` (indexing) + `Perplexity-User` (on-demand fetch). Both allowed.
- No submission form, but you can request faster re-crawl by submitting the URL through the Perplexity Discover flow when logged in.
- **Action**: create a Perplexity account with `enquiry@assessexpert.com`, occasionally query for "AssessExpert" and observe what it cites — gaps tell us what to blog about next.

### Google AI Overviews / Gemini
- Uses Googlebot + Google-Extended. Both allowed.
- No separate submission — being in Google's regular index puts you in AI Overviews eligibility.
- **Action**: Google Search Console (above) is the only lever.

### You.com / Neeva-successor / Kagi
- Each uses its own crawler + partner data.
- You.com: `YouBot` — no submission form.
- Kagi: paid search, small user base, indexes from open crawls. No submission needed.
- **Action**: none.

### Poe / Character.ai / Meta AI
- These consume search results from partners (Bing, Google) rather than crawl themselves.
- **Action**: none beyond Bing + Google.

---

## 4. Directory / catalogue listings that AI answer engines actually read

These are structured databases that AI systems pull from when
answering "what tool does X". Get listed on each:

- **G2** — https://sell.g2.com/ — free vendor profile, requires 1 verified review to be listed. Ask 3 pilot customers.
- **Capterra** — https://vendors.capterra.com/ — same shape as G2; both owned by Gartner Digital Markets, listing on one propagates to the other + Software Advice + GetApp.
- **Product Hunt** — one-time launch event. Schedule for a Tuesday, pre-notify email list.
- **AlternativeTo** — https://alternativeto.net/ — free, community-edited. Submit AssessExpert as an alternative to HackerRank, Codility, TestGorilla.
- **Crunchbase** — https://www.crunchbase.com/add-new — company profile. AI engines cite Crunchbase for founding date, funding, HQ.
- **LinkedIn Company Page** — verify + fully populate. Cited heavily by Google's Knowledge Panel.
- **Wikidata** — https://www.wikidata.org/ — create an entity for AssessExpert. Requires notable references (2+ independent secondary sources). Ties into Google Knowledge Graph.

---

## 5. Off-site signals that drive citation

AI answer engines cite what humans link to. The most efficient signals:

- **Guest posts** on HR-tech + recruiting blogs (SHRM, HR Executive, TLNT). Each backlink from a topical authority feeds every AI engine.
- **Podcast interviews** — transcripts are ingested by every training crawler. Book 3–5/year.
- **Case studies with real customers** hosted on our site AND published as PDFs/press releases. Distribute via PRNewswire ($400ish) for AI engines to pick up via news aggregators.
- **YouTube walkthroughs** of the platform. Video transcripts are ingested by Google + YouTube-based search grounding.
- **GitHub presence** — if we open-source any tooling (interview question generators, coding-question SDK), the README lands in Common Crawl and gets cited when developers ask about assessment tools.

---

## 6. Regeneration cadence

| Cadence | Action |
|---|---|
| On every publish | IndexNow ping (once wired in backend). |
| Weekly | Query ChatGPT, Claude, Perplexity, Gemini for "best pre-employment assessment platform UAE / GCC / MENA / Dubai" — screenshot the results. If we're not cited, look at who is and what content they have that we don't. |
| Monthly | Re-submit sitemap to Google + Bing Search Console (only needed after schema changes; otherwise auto-recrawls). |
| Quarterly | Publish 3–4 new long-form blog posts (2000+ words) targeting one topical gap identified from AI queries. |
| Annually | Refresh `lib/seo-schema.ts` — update review count, employee count, funding events. |

---

## 7. What NOT to do

- **Don't** submit to "AI directory" spam services promising to list you on "500 AI tools". They're SEO cesspools; links from them hurt more than help.
- **Don't** cloak — never serve different content to bots vs humans. Our content-negotiation proxy is compliant because it only responds to explicit `Accept: text/markdown`; the HTML is still what a browser gets by default.
- **Don't** stuff `llms.txt` with keywords. It's an index, not a landing page. Keep it factual.
- **Don't** disallow `GPTBot`/`anthropic-ai` in `robots.txt` unless there's a specific IP/licensing reason. Blocking training crawlers = your brand is invisible to next-gen models.

---

## 8. Escalation

If a specific engine mis-cites or refuses to cite us:

- **ChatGPT / OpenAI**: no support channel for this. Fix by improving the crawlable content it should be reading.
- **Perplexity**: support@perplexity.ai for factual corrections.
- **Google AI Overviews**: `search.google.com/search?q=<query>` → "Feedback" link at the bottom. Report the specific query.
- **Claude / Anthropic**: `support@anthropic.com` for factual corrections (rarely acted on for citation issues).

Contact ownership: **enquiry@assessexpert.com** is the address on file for
all AI-engine correspondence, per the site's `llms.txt`.
