# Security & Ops

How we keep secrets out of the repo, dependencies honest, the Sanity token safe, and the Vercel deploy boring. Right-sized for a solo, agent-driven portfolio: only what an agent (or the owner) actually needs to ship safely. For the architecture, see [`./architecture.md`](./architecture.md).

> Verify any framework claim against the bundled docs at `node_modules/next/dist/docs/` before writing code (see [`./working-with-agents.md`](./working-with-agents.md)). Next 16 / React 19 break model memory.

---

## 1. Secrets & env policy

### The one rule

**Never commit a secret — not even temporarily, not even "just to test."** `.env*` is gitignored (`!.env.example` is the lone exception). If a secret ever lands in a commit, treat it as compromised: rotate it, don't just `git rm` it (history keeps it).

### Public vs. secret — know the difference

The `NEXT_PUBLIC_*` prefix is the tripwire: **anything so prefixed is inlined into the browser bundle at build time.** Never give that prefix to a value that must stay private. [`../../.env.example`](../../.env.example) is the canonical, machine-readable list; this table explains the why.

| Variable                         | Public or secret?   | Why                                                                                                                                                                                             |
| -------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`           | **Public**          | The public site origin (no trailing slash); builds absolute URLs in `/rss.xml`.                                                                                                                 |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`  | **Public**          | Sanity project IDs are public by design — they ship in every client request. Plain env in `ci.yml`, not a secret.                                                                               |
| `NEXT_PUBLIC_SANITY_DATASET`     | **Public**          | The dataset name (`production`) is part of the client query URL.                                                                                                                                |
| `NEXT_PUBLIC_SANITY_API_VERSION` | **Public**          | A date string pinning the API contract. Non-sensitive.                                                                                                                                          |
| `NEXT_PUBLIC_SANITY_STUDIO_URL`  | **Public**          | The deployed Studio URL, for Visual Editing click-to-edit deep links.                                                                                                                           |
| `SANITY_API_READ_TOKEN`          | **Secret**          | Grants dataset read incl. drafts. Server-side only; attached per request by `defineLive` and the draft-mode enable handshake. **Never** `NEXT_PUBLIC_*`. See the Sanity token handling section. |
| `SANITY_API_BROWSER_TOKEN`       | **Secret (Viewer)** | next-sanity shares this with the browser (the `<SanityLive>` EventSource) for standalone live-draft preview, so it is a **dedicated minimum-scope Viewer** token — never the read token.        |
| `SANITY_REVALIDATE_SECRET`       | **Secret**          | HMAC secret the `/api/revalidate` webhook verifies; **must exactly match** the Secret on the Sanity webhook or every delivery 401s.                                                             |

Sanity project ID + dataset being public is a deliberate, documented fact — they're committed as plain env in [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) precisely because they aren't secrets. Don't "fix" this by moving them to GitHub Secrets.

### `.env.example` is a contract — keep it current

When you add a new env var, add it to [`../../.env.example`](../../.env.example) in the **same commit**, with a placeholder value and a one-line comment on what it is and whether it's public or secret. Anyone (human or agent) cloning the repo should learn the full env surface from that file alone.

The env readers in [`../../src/sanity/lib/env.ts`](../../src/sanity/lib/env.ts) `throw` on a missing required var via `assertValue` — a missing var fails loudly at boot, not silently at runtime. Mirror that pattern for any new required var.

### Agent checklist

- [ ] New secret? It is **not** `NEXT_PUBLIC_*` and is read only in server code.
- [ ] New var of any kind? It's in `.env.example` with a comment, in the same commit.
- [ ] Set the real value in Vercel (per-environment) and your local `.env.local`.
- [ ] `grep -rn "NEXT_PUBLIC" src/` shows only genuinely-public values.

---

## 2. Dependency hygiene

Right-sized: discipline, not a security org.

- **Commit `pnpm-lock.yaml` on every dependency change.** CI runs `pnpm install --frozen-lockfile`; an out-of-date lockfile fails the build. (A `feat`/`chore` commit that touches deps must include the lockfile.)
- **pnpm only** — `pnpm add` / `pnpm add -D`, never `npm`/`yarn`. `pnpm dlx`, not `npx`. (See [`./engineering-standards.md`](./engineering-standards.md).)
- **Vet new deps before adding** — prefer well-maintained, widely-used packages. A quick check on [deps.dev](https://deps.dev) is enough; full OpenSSF Scorecard automation is overkill here.
- **Run `pnpm audit` in any PR that changes `pnpm-lock.yaml`.** Triage only _exploitable_ advisories that reach reachable code; ignore transitive dev-only noise.
- **Breaking-major upgrades go one-per-branch with the full gate** — never a blind bump. (Open ones are tracked in the issue backlog.)
- **GitHub Actions are pinned** (`@v5`) in [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — keep them pinned when editing the workflow.

---

## 3. Sanity token handling

Two clients with different trust levels: the public published-content read path (no token), and the draft-capable read path used by draft mode / Visual Editing, which carries `SANITY_API_READ_TOKEN`.

- **The read token is a secret.** Server-side only. Never `NEXT_PUBLIC_*`, never in a Client Component, never in the bundle. It is attached per request by `defineLive` (`src/sanity/lib/live.ts`) and the draft-mode enable handler — never baked into an exported client. `sanityFetch.ts` carries `import "server-only"`.
- **Production read perspective is `published`.** The drafts-capable token + `drafts` perspective is gated behind draft mode (see the Vercel deploy runbook), never the default public read path.
- **The browser token is separate and minimum-scope.** `<SanityLive>` exposes `SANITY_API_BROWSER_TOKEN` to the browser EventSource for live preview, so it is a dedicated **Viewer** token, never the read token.
- **A leaked token = permanent compromise.** Rotate immediately in [sanity.io/manage](https://sanity.io/manage); revoking is the only fix. Give every token the **narrowest scope** that works (read, specific dataset).
- **CORS allow-list real origins only** — your prod domain and Vercel preview URLs (plus `localhost` for dev). Never wildcard-with-credentials. Configured in **Sanity → API → CORS Origins** at [sanity.io/manage](https://sanity.io/manage), not in the repo.
- **Stega off on `brandColor`/`fontKey`:** Visual Editing's invisible stega chars break the OKLCH parse and font lookup. This is a correctness landmine, not just cosmetics — the field exclusions are single-sourced in `src/sanity/lib/stega.ts`.

---

## 4. Vercel deploy runbook

Vercel is wired to the repo: **a merge to `main` deploys to production.** That's why `main` must always be green and shippable (see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md)). The CI gate in [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) is the guard — and because that gate regenerates and diff-checks `sanity.types.ts`, a drifted type file fails the build before it can reach prod.

For the **first production deploy** (and whenever the environment changes), work through the Production deploy checklist — env vars, Sanity CORS, schema/Studio deploy, the webhook, and the seed content the build doesn't verify.

### Preview vs. production

|            | Preview                           | Production                 |
| ---------- | --------------------------------- | -------------------------- |
| Trigger    | Every PR / non-`main` branch push | Merge/push to `main`       |
| Env vars   | Preview-scoped                    | Production-scoped          |
| Domain     | Auto generated `*.vercel.app`     | Aliased to the prod domain |
| Use it for | Reviewing a branch before merge   | Live site                  |

Never alias a preview deployment to the production domain. Set env vars **per environment** in the Vercel dashboard — a preview secret and a prod secret are different values.

### Draft mode & live preview

- The enable + exit handlers are **Route Handlers** (`app/api/draft-mode/{enable,disable}/route.ts`), using `next-sanity`'s `defineEnableDraftMode` — it validates a secret, then calls `await draftMode().enable()`. These run server-side; don't drive draft mode from `proxy.ts` (it's Node-only and that's not its job — see `…/03-file-conventions/proxy.md`, which confirms a `runtime` config in proxy throws). `proxy.ts` is deliberately not added for this reason.
- **`draftMode()` is async in Next 16** — `await` it (verify in `node_modules/next/dist/docs/`).
- The content read path is next-sanity `defineLive`: `sanityFetch` reads `draftMode().isEnabled` inside `use cache` and serves the `drafts` perspective (stega on) under Draft Mode, the published CDN perspective otherwise. Freshness on the published path is on-demand via the publish→revalidate webhook (see the Production deploy checklist), not time-based.
- Vercel preview deployments are already `noindex` at the platform level. If you ever surface draft content on an indexable URL, set `X-Robots-Tag: noindex`.

### If prod breaks

1. **Roll back first.** Use Vercel's **Instant Rollback** from the dashboard to return prod to a known-good deployment — no rebuild. Then fix-forward on a branch.
2. For the exact promote/rollback steps, follow [Vercel's deployment docs](https://vercel.com/docs/deployments) rather than memorized mechanics — if a doc here disagrees with the dashboard, the dashboard wins.

---

## 5. Production deploy checklist

What must be true for a **production deploy to actually work** — the env- and Sanity-side setup the build alone doesn't verify (the build can pass while Preview, Visual Editing, or content rendering are misconfigured). Run the one-time items before the first production deploy and whenever the environment changes; run the every-deploy items each time.

### One-time setup (per environment)

**Vercel → Project → Settings → Environment Variables** — mirror [`../../.env.example`](../../.env.example), set per environment (a preview value and a prod value differ):

- [ ] All `NEXT_PUBLIC_*` vars (see the Secrets & env policy section), incl. `NEXT_PUBLIC_SANITY_STUDIO_URL` pointing at the deployed Studio.
- [ ] `SANITY_API_READ_TOKEN`, `SANITY_API_BROWSER_TOKEN`, `SANITY_REVALIDATE_SECRET` (all secret, server-side scope).

**Sanity → [sanity.io/manage](https://sanity.io/manage):**

- [ ] **CORS origins** — add the production domain, Vercel preview URLs, and `localhost` (`:3000`/`:3333`), **with credentials**. Required before Preview / Visual Editing work. Never wildcard-with-credentials.
- [ ] **Deploy the Studio schema to the Content Lake.** Use **`sanity deploy`** (the full Studio deploy below also pushes the schema, `✔ Deployed 1/1 schemas`, and runs fine locally). Not required for the Next build, but Presentation / Visual Editing and Sanity MCP schema validation rely on it. ⚠️ The standalone `sanity schemas deploy` is currently broken (Rolldown native-binary SIGABRT, darwin + linux CI) — tracked in the [issue backlog](https://github.com/jamierthompson/digital-garden/issues); refresh the schema via `sanity deploy` until it's fixed.
- [ ] **Deploy the Studio** (where editors sign in) — `pnpm --filter studio deploy` (= `sanity deploy`); host + appId are pinned in `studio/sanity.cli.ts` so it's non-interactive. To make the hosted Studio's Presentation preview prod, deploy with `SANITY_STUDIO_PREVIEW_URL=<prod-url>` (a bare deploy reverts it to `localhost:3000`). Then point `NEXT_PUBLIC_SANITY_STUDIO_URL` at its URL.
- [ ] **Register the publish→revalidation webhook** — Sanity → API → Webhooks → Create: URL `<prod-url>/api/revalidate`, dataset `production`, trigger Create/Update/Delete, filter `_type in ["project","siteSettings","note"]`, **no projection**, drafts/versions **off**, HTTP POST, **Secret = `SANITY_REVALIDATE_SECRET`** (must match Vercel exactly). Without it, a published change won't appear on prod until a redeploy. Verify: publish anything → the webhook's attempt log shows `200 {revalidated:true}`.

**Required content (in the `production` dataset):**

- [ ] A **`siteSettings` singleton** (`_id: "siteSettings"`) — it drives the shell brand/font; a missing one degrades to the engine fallback, never an error.
- [ ] At least one **published `project`** per flat `/[slug]` route.

### Every deploy

- [ ] **Full gate green locally** before pushing — the CI `verify` chain (AGENTS.md "Pre-flight checks" / [the one command](./definition-of-done.md#1-the-one-command)). CI re-runs it as the guard before prod.
- [ ] Reach `main` **only via squash-merge of a reviewed PR** — never commit to `main` (merge deploys to prod). (the Opening-a-PR step; see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md))
- [ ] After any **Studio schema change**: commit the regenerated root `sanity.types.ts` (CI diff-checks it) and redeploy the schema (`sanity deploy`).

---

## Anchors

- Architecture: [`./architecture.md`](./architecture.md) — the Content model section (content/query boundary) and Repo & hosting section (rendering / deploy).
- Files: [`ci.yml`](../../.github/workflows/ci.yml) · [`.env.example`](../../.env.example) · [`src/sanity/lib/client.ts`](../../src/sanity/lib/client.ts) · [`src/sanity/lib/env.ts`](../../src/sanity/lib/env.ts).
- Siblings: [`./engineering-standards.md`](./engineering-standards.md) · [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) · [`./working-with-agents.md`](./working-with-agents.md) · [`./accessibility-and-performance.md`](./accessibility-and-performance.md).
