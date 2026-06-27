# Production deploy checklist

A standalone, durable checklist of what must be true for a **production deploy to actually work** —
the env-side and Sanity-side setup the build alone doesn't verify (the build can pass while Preview,
Visual Editing, or even content rendering are misconfigured). It lives at `docs/` root, not inside a
session record or PR body, so it doesn't get buried.

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
- [ ] `SANITY_API_BROWSER_TOKEN` — **SECRET-ish, a dedicated minimum-scope Viewer token** `[D31]`. next-sanity's `<SanityLive>` exposes it to the browser EventSource for real-time preview, so it is **never** the read token. Mint a separate Viewer token; rotate on leak.
- [ ] `SANITY_REVALIDATE_SECRET` — **SECRET, server-side only** `[D31]`. HMAC secret the `/api/revalidate` webhook verifies; **must exactly match** the Secret set on the Sanity webhook (below).

### Sanity project — [sanity.io/manage](https://sanity.io/manage)

- [ ] **CORS origins** — add the production domain **and** Vercel preview URLs (Sanity → API → CORS Origins). Never wildcard-with-credentials. Required before Preview / Visual Editing will work. (security-and-ops §3)
- [ ] **Deploy the Studio schema to the Content Lake** — the schema deploys **for free as part of `sanity deploy`** (the Studio deploy below, which also pushes the schema — `✔ Deployed 1/1 schemas`) and **runs fine locally on darwin-x64**. Use that as the primary path. **Not** required for the Next build, but Presentation / Visual Editing and Sanity MCP schema validation rely on the deployed schema. _**Done 2026-06-27** — schema is live in the Content Lake (rode along with the `sanity deploy` Studio deploy)._
  - ⚠️ **The standalone `sanity schemas deploy` is currently broken everywhere** — it loads Rolldown's native binary, which **SIGABRTs on darwin-x64** (the owner's machine; reproduced on `@sanity/cli` 7.2.3 + 7.4.0, Node 20 + 22) **and, since ~2026-06-27, on linux-x64 CI too** (the **Deploy Sanity Schema** workflow `deploy-schema.yml` now SIGABRTs; it last passed 2026-06-25, before the PR #31 lockfile move). So the **CI schema-deploy workaround from PR #25 no longer works** — until the Rolldown regression is root-caused (or the workflow is switched to `sanity deploy`), refresh the schema via `sanity deploy`. Tracked in [`build-phases.md`](./build-phases.md) (review-surfaced follow-ups).
- [ ] **Deploy the Studio itself** (where editors sign in) — `pnpm --filter studio deploy` (= `sanity deploy`), then point `NEXT_PUBLIC_SANITY_STUDIO_URL` at its URL. The host + appId are pinned in `studio/sanity.cli.ts` so the deploy is non-interactive. Note: `sanity deploy` (Studio) **also deploys the schema** and runs fine locally on darwin-x64 — it's the standalone `sanity schemas deploy` that hits the Rolldown SIGABRT (on darwin **and** now on linux CI — above). To make the **hosted** Studio's Presentation preview prod, deploy it with `SANITY_STUDIO_PREVIEW_URL=<prod-url>` (baked into the bundle; a bare deploy reverts it to `localhost:3000`). _Done 2026-06-27: [jamiethompson-garden.sanity.studio](https://jamiethompson-garden.sanity.studio)._
- [ ] **Register the publish→revalidation webhook** `[D31]` — Sanity → API → Webhooks → Create: URL `<prod-url>/api/revalidate`, dataset `production`, trigger on Create/Update/Delete, filter `_type in ["project","siteSettings","note"]`, **no projection** (sends the full doc, which carries `_type`), drafts/versions **off**, HTTP POST, and **Secret = `SANITY_REVALIDATE_SECRET`** (must match Vercel exactly, or every delivery 401s). Without it, a published change won't appear on prod until a redeploy (the read path is `cacheLife` 1y; freshness is on-demand via tag revalidation). Verify: publish anything → the webhook's attempt log shows `200 {revalidated:true}`. _Done 2026-06-27._

### Required content (in the `production` dataset)

- [ ] A **`siteSettings` singleton** must exist — it drives the shell brand/font (`ProjectScope slug="garden"`); a missing one degrades to the engine fallback palette, never an error `[D9]`. _Phase 3 seeded one (`_id: "siteSettings"`)._
- [ ] At least one **published `project`** per `/work/<slug>` route. _Phase 3 seeded `first-light`._

## Every deploy

- [ ] **Full gate green locally** before pushing — the CI `verify` chain (see AGENTS.md "Pre-flight checks"). CI re-runs it on the PR and is the guard before prod `[D17, D19]`.
- [ ] Reach `main` **only via squash-merge of a reviewed PR** — never commit to `main` (merge deploys to prod). (security-and-ops §4, git-and-pr-workflow §6)
- [ ] After any **Studio schema change**: commit the regenerated root `sanity.types.ts` (CI diff-checks it `[D23]`). The schema redeploy is **automated** — the **Deploy Sanity Schema** workflow runs on `main` pushes that touch the schema (or dispatch it manually) so the Content Lake matches the code.

## If prod breaks

- [ ] **Instant Rollback** from the Vercel dashboard to a known-good deployment (no rebuild), then fix-forward on a branch. Follow [Vercel's deployment docs](https://vercel.com/docs/deployments) for current mechanics. (security-and-ops §4)
