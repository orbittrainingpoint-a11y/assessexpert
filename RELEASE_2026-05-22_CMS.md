# Live Deploy — CMS + Marketing Redesign (2026-05-22)

This release adds the public marketing-site redesign, the blog, full SEO
(sitemap/robots/metadata), and the **CMS with its own login**. It ships
**one new database migration** and **one new seed**.

> All commands run from the repo root on the VPS:
> `cd /var/www/html/assessexpert`

## 1. Pull the code

```bash
git pull origin main
```

## 2. Backend — install, migrate, seed, build, reload

```bash
cd backend
npm install                       # picks up nothing new server-side, but keeps lockfile honest
npx prisma migrate deploy         # applies the new CMS migration (idempotent — see list below)
npx prisma generate               # regenerate client for the new CMS models (postinstall usually does this)
npx ts-node prisma/seed-cms.ts    # creates the CMS admin user + page rows + sample blog posts
npm run build
pm2 reload assessexpert-backend --update-env
cd ..
```

`npx prisma migrate deploy` is safe to run anytime — it only applies
migrations not yet recorded in the `_prisma_migrations` table. If the
server is already current through `20260520140000_org_timezone`, it
applies exactly one: `20260521161950_add_cms_models`.

## 3. Frontend — install, build, reload

```bash
cd frontend/portal
npm install                       # MANDATORY — pulls isomorphic-dompurify + lucide-react if missing
npm run build
pm2 reload assessexpert-frontend --update-env
cd ../..
```

> The frontend build will fail with `Module not found` if `npm install`
> is skipped after a pull (this is what bit us before). Always install first.

## Full migration list (chronological)

`migrate deploy` applies any of these not yet on the server. The server
should already have #1–#11 from the previous release; **#12 is new.**

| # | Migration | What it adds |
|---|-----------|--------------|
| 1 | `20260510102617_add_multi_candidate_support` | Multi-candidate session rows |
| 2 | `20260511222441_add_practical_paper_sets` | Practical paper sets |
| 3 | `20260516120000_add_verification_transcript` | Verification transcript |
| 4 | `20260518120000_add_candidate_reference_photo` | Reference photo |
| 5 | `20260518150000_per_candidate_mcq` | Per-candidate MCQ |
| 6 | `20260518180000_per_candidate_checklist_report` | Per-candidate checklist/report |
| 7 | `20260519080000_session_candidate_recording_paths` | Per-candidate recording paths |
| 8 | `20260519100000_per_candidate_practical` | Per-candidate practical |
| 9 | `20260519120000_fr_log_candidate_id` | FR log candidateId |
| 10 | `20260520120000_unify_to_multi_candidate` | Backfill all sessions to multi-candidate |
| 11 | `20260520140000_org_timezone` | `Organization.timezone` |
| 12 | **`20260521161950_add_cms_models`** | **`CmsPage`, `CmsPost`, `CmsMedia` + `CMS_ADMIN`/`CMS_EDITOR` roles** |

### Verify migration state at any time
```bash
cd backend && npx prisma migrate status
```
Expect: "Database schema is up to date!". If it reports **drift**, see
`DEPLOY.md → Drift recovery` — do NOT run `migrate reset` on production.

## Seeds

| Seed | Command | When to run | Idempotent? |
|------|---------|-------------|-------------|
| Base users/orgs | `node prisma/seed.js` *(or `npm run prisma:seed` → `seed-full.js`)* | first-time setup only | yes (upserts) |
| Demo candidate | `npx ts-node prisma/seed-ahmed.ts` | demo/testing only | yes |
| **CMS** | `npx ts-node prisma/seed-cms.ts` | **this release, once** | **yes (upserts)** |

`seed-cms.ts` creates:
- **CMS admin user** → `cms@assessexpert.ae` / `CmsAdmin@2026!`
  (role `CMS_ADMIN`). **Change this password after first login.**
- `CmsPage` rows for home/about/services/contact (SEO + home hero copy).
- 2 sample published blog posts.

Re-running it is safe — it upserts and won't duplicate or overwrite
edits you've made in the CMS.

## Access after deploy

| Surface | URL |
|---------|-----|
| Marketing site | `https://assessexpert.ae/` |
| Blog | `https://assessexpert.ae/blog` |
| **CMS login (separate)** | `https://assessexpert.ae/cms/login` |
| Staff portal (unchanged) | `https://app.assessexpert.ae/login` |

## Post-deploy smoke (optional)

```bash
# public CMS read should return the home page content
curl -s https://api.assessexpert.ae/api/cms/public/pages/home | head -c 200
# published posts
curl -s https://api.assessexpert.ae/api/cms/public/posts | head -c 200
```

## Rollback

The migration only **adds** tables/enum values — it does not alter or
drop existing data, so a code rollback is safe without a DB rollback.
To revert code: check out the previous submodule commit and rebuild.
The new tables can be left in place harmlessly.
