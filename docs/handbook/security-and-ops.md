# Security & Ops

How we keep secrets out of the repo, dependencies honest, the Sanity token safe, and the Vercel deploy boring. Right-sized for a solo, agent-driven portfolio: only what an agent (or the owner) actually needs to ship safely. For the architecture, see [`../architecture-plan.md`](../architecture-plan.md); for binding calls, [`../decisions.md`](../decisions.md).

> Verify any framework claim against the bundled docs at `node_modules/next/dist/docs/` before writing code (see [`./working-with-agents.md`](./working-with-agents.md)). Next 16 / React 19 break model memory.

---

## 1. Secrets & env policy

### The one rule

**Never commit a secret — not even temporarily, not even "just to test."** `.env*` is gitignored (`!.env.example` is the lone exception). If a secret ever lands in a commit, treat it as compromised: rotate it, don't just `git rm` it (history keeps it).

### Public vs. secret — know the difference

The `NEXT_PUBLIC_*` prefix is the tripwire: **anything so prefixed is inlined into the browser bundle at build time.** Never give that prefix to a value that must stay private.

| Variable                                         | Public or secret? | Why                                                                                                                                                                                                               |
| ------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`                  | **Public**        | Sanity project IDs are public by design — they ship in every client request. Plain env in `ci.yml` (`7id6sf36`), not a secret.                                                                                    |
| `NEXT_PUBLIC_SANITY_DATASET`                     | **Public**        | Same — the dataset name (`production`) is part of the client query URL.                                                                                                                                           |
| `NEXT_PUBLIC_SANITY_API_VERSION`                 | **Public**        | A date string pinning the API contract. Non-sensitive.                                                                                                                                                            |
| `SANITY_API_READ_TOKEN` (Phase 2, not yet wired) | **Secret**        | Grants dataset read incl. drafts. Server-side only. **Never** `NEXT_PUBLIC_*`. See §3. This is the env var name `next-sanity`'s `defineEnableDraftMode` example uses, so it's the name we'll adopt — not a guess. |

Sanity project ID + dataset being public is a deliberate, documented fact — they're committed as plain env in [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) precisely because they aren't secrets. Don't "fix" this by moving them to GitHub Secrets.

### `.env.example` is a contract — keep it current

When you add a new env var, add it to [`../../.env.example`](../../.env.example) in the **same commit**, with a placeholder value and a one-line comment on what it is and whether it's public or secret. Anyone (human or agent) cloning the repo should learn the full env surface from that file alone.

Today `.env.example` holds exactly the three public Sanity vars and **no token line** — don't add one until the token actually lands. When draft mode arrives in Phase 2, add a commented `SANITY_API_READ_TOKEN=` line (marked secret / server-only) in the same commit that wires it.

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
- **GitHub Actions are pinned** (`@v4`) in [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — keep them pinned when editing the workflow.

---

## 3. Sanity token handling

Today the client uses **`useCdn: true`** with **no token** ([`../../src/sanity/lib/client.ts`](../../src/sanity/lib/client.ts)) — published content only, fully public, nothing secret in play. A token enters the picture only when we add **draft mode / Visual Editing** (Phase 2, [`../build-phases.md`](../build-phases.md); [D16]).

When that token lands:

- **It is a secret.** Server-side only. Never `NEXT_PUBLIC_*`, never in a Client Component, never in the bundle. We'll name it `SANITY_API_READ_TOKEN` (the name `next-sanity`'s `defineEnableDraftMode` example uses).
- **Production read perspective is `published`.** The drafts-capable token + `previewDrafts`/`drafts` perspective is gated behind draft mode (§4), never the default public read path.
- **A leaked token = permanent compromise.** Rotate immediately in [sanity.io/manage](https://sanity.io/manage); revoking is the only fix (you can't un-leak it). Give it the **narrowest scope** that works (read, specific dataset).
- **CORS allow-list real origins only** — your prod domain and Vercel preview URLs. Never wildcard-with-credentials. Configured in **Sanity → API → CORS Origins** at [sanity.io/manage](https://sanity.io/manage), not in the repo.
- **Stega off on `brandColor`/`fontKey`** [D16]: Visual Editing's invisible stega chars break the OKLCH parse and font lookup. This is a correctness landmine, not just cosmetics — disable stega on those fields.

---

## 4. Vercel deploy runbook

Vercel is wired to the repo: **a merge to `main` deploys to production.** That's why `main` must always be green and shippable (see [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md)). The CI gate in [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml) is the guard [D17][D19] — and because that gate regenerates and diff-checks `sanity.types.ts`, a drifted type file fails the build before it can reach prod [D23].

### Preview vs. production

|            | Preview                           | Production                 |
| ---------- | --------------------------------- | -------------------------- |
| Trigger    | Every PR / non-`main` branch push | Merge/push to `main`       |
| Env vars   | Preview-scoped                    | Production-scoped          |
| Domain     | Auto generated `*.vercel.app`     | Aliased to the prod domain |
| Use it for | Reviewing a branch before merge   | Live site                  |

Never alias a preview deployment to the production domain. Set env vars **per environment** in the Vercel dashboard — a preview secret and a prod secret are different values.

### If prod breaks

1. **Roll back first.** Use Vercel's **Instant Rollback** from the dashboard to return prod to a known-good deployment — no rebuild. Then fix-forward on a branch.
2. For the exact promote/rollback steps and their current semantics, follow [Vercel's deployment docs](https://vercel.com/docs/deployments) rather than memorized mechanics — Vercel changes CLI/dashboard behavior without warning. If a doc here disagrees with the dashboard, the dashboard wins.

### Draft mode (Phase 2, when Visual Editing lands [D16])

- Implement the enable + exit handlers as **Route Handlers** (e.g. `app/api/draft-mode/enable/route.ts`), using `next-sanity`'s `defineEnableDraftMode` — it validates a secret, then calls `await draftMode().enable()`. These run server-side; don't try to drive draft mode from `proxy.ts` (it's Node-only and that's not its job — see `…/03-file-conventions/proxy.md`, which confirms a `runtime` config in proxy throws).
- **`draftMode()` is async in Next 16** — `await` it (verify in `node_modules/next/dist/docs/`).
- Provide an **exit route** that calls `await draftMode().disable()`.
- Vercel preview deployments are already `noindex` at the platform level, so draft content behind a bypass cookie isn't a normal indexing risk. If you ever surface draft content on an indexable URL, set `X-Robots-Tag: noindex` (general SEO practice, not a Next requirement).

---

## Anchors

- Decisions: [D16] Visual-editing / stega · [D17] risk-retirement build sequence (CI gate in Phase 0) · [D19] cross-cutting concerns scheduled (CI in Phase 0) · [D23] standalone Studio workspace (TypeGen diff-gated in CI).
- Plan: §6 (content/query boundary), §7 (rendering / deploy).
- Files: [`ci.yml`](../../.github/workflows/ci.yml) · [`.env.example`](../../.env.example) · [`src/sanity/lib/client.ts`](../../src/sanity/lib/client.ts) · [`src/sanity/lib/env.ts`](../../src/sanity/lib/env.ts).
- Siblings: [`./engineering-standards.md`](./engineering-standards.md) · [`./git-and-pr-workflow.md`](./git-and-pr-workflow.md) · [`./working-with-agents.md`](./working-with-agents.md) · [`./accessibility-and-performance.md`](./accessibility-and-performance.md).
