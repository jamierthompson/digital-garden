# Security & Ops

How we keep secrets out of the repo, dependencies honest, the Sanity token safe, and the Vercel deploy boring. Right-sized for a solo, agent-driven portfolio: only what an agent (or the owner) actually needs to ship safely. For the architecture, see [`../../architecture-plan.md`](../../architecture-plan.md); for binding calls, [`../../decisions.md`](../../decisions.md).

> Verify any framework claim against the bundled docs at `node_modules/next/dist/docs/` before writing code (see [`./working-with-agents.md`](./working-with-agents.md)). Next 16 / React 19 break model memory.

---

## 1. Secrets & env policy

### The one rule

**Never commit a secret — not even temporarily, not even "just to test."** `.env*` is gitignored (`!.env.example` is the lone exception). If a secret ever lands in a commit, treat it as compromised: rotate it, don't just `git rm` it (history keeps it).

### Public vs. secret — know the difference

The `NEXT_PUBLIC_*` prefix is the tripwire: **anything so prefixed is inlined into the browser bundle at build time.** Never give that prefix to a value that must stay private.

| Variable                             | Public or secret? | Why                                                                                                                            |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`      | **Public**        | Sanity project IDs are public by design — they ship in every client request. Plain env in `ci.yml` (`7id6sf36`), not a secret. |
| `NEXT_PUBLIC_SANITY_DATASET`         | **Public**        | Same — the dataset name (`production`) is part of the client query URL.                                                        |
| `NEXT_PUBLIC_SANITY_API_VERSION`     | **Public**        | A date string pinning the API contract. Non-sensitive.                                                                         |
| `SANITY_API_READ_TOKEN` (when added) | **Secret**        | Grants dataset read incl. drafts. Server-side only. **Never** `NEXT_PUBLIC_*`. See §3.                                         |

Sanity project ID + dataset being public is a deliberate, documented fact — they're committed as plain env in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) precisely because they aren't secrets. Don't "fix" this by moving them to GitHub Secrets.

### `.env.example` is a contract — keep it current

When you add a new env var, add it to [`.env.example`](../../../.env.example) in the **same commit**, with a placeholder value and a one-line comment on what it is and whether it's public or secret. Anyone (human or agent) cloning the repo should learn the full env surface from that file alone.

```bash
# .env.example — Sanity values are public (shipped to the browser), not secrets.
NEXT_PUBLIC_SANITY_PROJECT_ID=your-project-id
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2026-06-21
# SANITY_API_READ_TOKEN=   # secret — server-only, set in Vercel + .env.local, never NEXT_PUBLIC_*
```

The env readers in [`src/sanity/lib/env.ts`](../../../src/sanity/lib/env.ts) `throw` on a missing required var via `assertValue` — a missing var fails loudly at boot, not silently at runtime. Mirror that pattern for any new required var.

### Agent checklist

- [ ] New secret? It is **not** `NEXT_PUBLIC_*` and is read only in server code.
- [ ] New var of any kind? It's in `.env.example` with a comment, in the same commit.
- [ ] Set the real value in Vercel (per-environment) and your local `.env.local`.
- [ ] `grep -rn "NEXT_PUBLIC" src/` shows only genuinely-public values.

---

## 2. Dependency hygiene

Right-sized per OpenSSF/OWASP guidance — discipline, not a security org.

- **Commit `pnpm-lock.yaml` on every dependency change.** CI runs `pnpm install --frozen-lockfile`; an out-of-date lockfile fails the build. (`feat`/`chore` commit that touches deps must include the lockfile.)
- **pnpm only** — `pnpm add` / `pnpm add -D`, never `npm`/`yarn`. `pnpm dlx`, not `npx`. (See [`./engineering-standards.md`](./engineering-standards.md).)
- **Vet new deps before adding** — prefer well-maintained, widely-used packages. A quick check on [deps.dev](https://deps.dev) / OpenSSF Scorecard is enough; full Scorecard automation is overkill here.
- **`pnpm audit`** occasionally and before a dependency-heavy PR. Triage real exploitable issues; don't chase transitive noise.
- **GitHub Actions are pinned** (`@v4`) in [`ci.yml`](../../../.github/workflows/ci.yml) — keep them pinned when editing the workflow.

---

## 3. Sanity token handling

Today the client uses **`useCdn: true`** with **no token** ([`src/sanity/lib/client.ts`](../../../src/sanity/lib/client.ts)) — published content only, fully public, nothing secret in play. A token enters the picture only when we add **draft mode / Visual Editing** (Phase 2, [`../../build-phases.md`](../../build-phases.md); [D16]).

When that token lands:

- **It is a secret.** Server-side only. Never `NEXT_PUBLIC_*`, never in a Client Component, never in the bundle.
- **Production read perspective is `published`.** The drafts-capable token + `previewDrafts`/`drafts` perspective is gated behind draft mode (§4), never the default public read path.
- **A leaked token = permanent compromise.** Rotate immediately in [sanity.io/manage](https://sanity.io/manage); revoking is the only fix (you can't un-leak it). Give it the **narrowest scope** that works (read, specific dataset).
- **CORS allow-list real origins only** — your prod domain and Vercel preview URLs. Never wildcard-with-credentials.
- **Stega off on `brandColor`/`fontKey`** [D16]: Visual Editing's invisible stega chars break the OKLCH parse and font lookup. This is a correctness landmine, not just cosmetics — disable stega on those fields.

---

## 4. Vercel deploy runbook

Vercel is wired to the repo: **a merge to `main` deploys to production.** That's why `main` must always be green and shippable (see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md)). The CI gate in [`ci.yml`](../../../.github/workflows/ci.yml) is the guard [D17][D19].

### Preview vs. production

|            | Preview                           | Production                 |
| ---------- | --------------------------------- | -------------------------- |
| Trigger    | Every PR / non-`main` branch push | Merge/push to `main`       |
| Env vars   | Preview-scoped                    | Production-scoped          |
| Domain     | Auto generated `*.vercel.app`     | Aliased to the prod domain |
| Use it for | Reviewing a branch before merge   | Live site                  |

Never alias a preview deployment to the production domain. Set env vars **per environment** in the Vercel dashboard — a preview secret and a prod secret are different values.

> The promote/rollback ops below describe Vercel's documented behavior. If anything here doesn't match the dashboard, the dashboard wins — confirm before acting on a live deploy.

### Promote

A deployment already built for production **promotes instantly with no rebuild** — Vercel just re-aliases the prod domain to it. Use this to ship a vetted preview without a fresh build.

### Draft mode (Phase 2, when Visual Editing lands [D16])

- Implemented via `next-sanity/draft-mode` `defineEnableDraftMode` — validates a secret, then calls `await draftMode().enable()`. **`draftMode()` is async in Next 16** — `await` it (verify in `node_modules/next/dist/docs/`).
- **Node runtime only** — the Edge runtime can't set the draft cookie. (Aligns with [D-proxy]: `proxy.ts` is Node-only too.)
- Provide an **exit route** that calls `draftMode().disable()`.
- Send `X-Robots-Tag: noindex` while draft mode is enabled so preview content never gets indexed.

### Rollback

- **Instant Rollback** re-aliases a previously-_production_ deployment back to prod — no rebuild. Previews are ineligible. CLI: `pnpm dlx vercel rollback`.
- Fastest recovery when a deploy breaks prod: roll back first, then fix forward on a branch.

---

## Anchors

- Decisions: [D16] Visual-editing / stega, [D17] risk-retirement guardrails, [D19] CI gate, [D23] standalone Studio workspace.
- Plan: §6 (content/query boundary), §7 (rendering / deploy).
- Files: [`ci.yml`](../../../.github/workflows/ci.yml) · [`.env.example`](../../../.env.example) · [`src/sanity/lib/client.ts`](../../../src/sanity/lib/client.ts) · [`src/sanity/lib/env.ts`](../../../src/sanity/lib/env.ts).
- Siblings: [`./engineering-standards.md`](./engineering-standards.md) · [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) · [`./working-with-agents.md`](./working-with-agents.md) · [`./accessibility-and-performance.md`](./accessibility-and-performance.md).
