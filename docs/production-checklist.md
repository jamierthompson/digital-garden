# Production deploy checklist

A standalone, durable checklist of what must be true for a **production deploy to actually work** —
the env-side and Sanity-side setup the build alone doesn't verify (the build can pass while Preview,
Visual Editing, or even content rendering are misconfigured). It lives at `docs/` root, not inside a
run record or PR body, so it doesn't get buried.

> **Merge to `main` = a production deploy on Vercel.** Run the one-time items before the first
> production deploy (and again whenever the environment changes); run the every-deploy items each
> time. Ops detail and rationale live in [`handbook/security-and-ops.md`](./handbook/security-and-ops.md)
> §1/§3/§4 — this is the actionable index.

## One-time setup (per environment)

### Environment variables — Vercel → Project → Settings → Environment Variables

Mirror [`.env.example`](../.env.example), **set per environment** (a preview value and a prod value
differ). Public vars ship to the browser; the read token must not.

- [ ] `NEXT_PUBLIC_SITE_URL` — public site origin, **no trailing slash** (builds absolute URLs in `/rss.xml`)
- [ ] `NEXT_PUBLIC_SANITY_PROJECT_ID` — public
- [ ] `NEXT_PUBLIC_SANITY_DATASET` — public (`production`)
- [ ] `NEXT_PUBLIC_SANITY_API_VERSION` — public (pinned date)
- [ ] `NEXT_PUBLIC_SANITY_STUDIO_URL` — public; the **deployed Studio URL** (Visual Editing click-to-edit deep links)
- [ ] `SANITY_API_READ_TOKEN` — **SECRET, server-side only, never `NEXT_PUBLIC_*`** `[D16]`. Grants dataset reads incl. drafts; attached per-request in the draft-mode handler. A leak = rotate at [sanity.io/manage](https://sanity.io/manage). Only needed once draft mode / Visual Editing is used. (security-and-ops §1, §3)

### Sanity project — [sanity.io/manage](https://sanity.io/manage)

- [ ] **CORS origins** — add the production domain **and** Vercel preview URLs (Sanity → API → CORS Origins). Never wildcard-with-credentials. Required before Preview / Visual Editing will work. (security-and-ops §3)
- [ ] **Deploy the Studio schema to the Content Lake** — from the `studio/` workspace run `npx sanity schema deploy` (or use the `sanity:deploy-schema` skill). **Not** required for the Next build, but Presentation / Visual Editing and Sanity MCP schema validation rely on the deployed schema. _As of Phase 3 the schema is modeled but not yet deployed._
- [ ] **Deploy the Studio itself** (where editors sign in) — `pnpm --filter studio deploy` (= `sanity deploy`), then point `NEXT_PUBLIC_SANITY_STUDIO_URL` at its URL.

### Required content (in the `production` dataset)

- [ ] A **`siteSettings` singleton** must exist — it drives the shell brand/font (`ProjectScope slug="garden"`); a missing one degrades to the engine fallback palette, never an error `[D9]`. _Phase 3 seeded one (`_id: "siteSettings"`)._
- [ ] At least one **published `project`** per `/work/<slug>` route. _Phase 3 seeded `first-light`._

## Every deploy

- [ ] **Full gate green locally** before pushing — the CI `verify` chain (see AGENTS.md "Pre-flight checks"). CI re-runs it on the PR and is the guard before prod `[D17, D19]`.
- [ ] Reach `main` **only via squash-merge of a reviewed PR** — never commit to `main` (merge deploys to prod). (security-and-ops §4, git-and-pr-workflow §6)
- [ ] After any **Studio schema change**: commit the regenerated root `sanity.types.ts` (CI diff-checks it `[D23]`) **and** re-run the schema deploy above so the Content Lake matches the code.

## If prod breaks

- [ ] **Instant Rollback** from the Vercel dashboard to a known-good deployment (no rebuild), then fix-forward on a branch. Follow [Vercel's deployment docs](https://vercel.com/docs/deployments) for current mechanics. (security-and-ops §4)
