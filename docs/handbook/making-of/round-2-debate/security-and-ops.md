# Round-2 Debate — Security & Ops

Devil's-advocate review of [`../round-1-drafts/security-and-ops.md`](../round-1-drafts/security-and-ops.md).
Verified against the installed Next **16.2.9** docs (`node_modules/next/dist/docs/`), `next-sanity`'s shipped types, the real `ci.yml` / `.env.example` / `env.ts` / `client.ts`, and the 23 ADRs in [`../../../decisions.md`](../../../decisions.md).

**Verdict:** strong, well-anchored draft. The public-vs-secret framing is exactly right and provably matches the repo. Two findings are genuinely blocking (a fabricated `.env.example` line; the `[D-proxy]` anchor the author already flagged). The rest are tightening, not rework. Concede first, then attack.

---

## What's good (concede up front)

- **§1 public-vs-secret table is accurate and load-bearing.** Verified: `ci.yml` carries `NEXT_PUBLIC_SANITY_PROJECT_ID: 7id6sf36` and `NEXT_PUBLIC_SANITY_DATASET: production` as _plain_ `env:`, with the comment "are public … not secrets." The draft's claim that these are public-by-design and must _not_ be moved to GitHub Secrets is correct and worth stating.
- **§1 `assertValue` description is exactly right.** `env.ts` does `throw new Error(...)` via `assertValue` for `dataset` and `projectId`. "Fails loudly at boot" is accurate. Good that it tells agents to _mirror the pattern_, not invent a new one.
- **§3 token framing is honest.** `client.ts` is verified `useCdn: true` with no token. Framing the token as forward-looking for Phase 2 [D16] is the correct call — don't document a secret that doesn't exist yet.
- **§3 stega-on-`brandColor`/`fontKey` warning** matches [D16] verbatim ("invisible encoding chars break the OKLCH parse and font lookup"). Calling it a "correctness landmine, not cosmetics" is the right emphasis.
- **Framework async claims verified true:** `draftMode()` _is_ async in 16.2.9 — `draft-mode.md` and the `draftMode` API ref both show `await draftMode()` and call it "an **async** function." The "verify in bundled docs" inline nudge is good house style.
- **`defineEnableDraftMode` is real** — it ships in `next-sanity/draft-mode` and the helper's own JSDoc example uses `SANITY_API_READ_TOKEN` as the env var name (see Finding 6). The draft's mechanism description matches the type signature.
- **Right-sized cuts are correct.** Dropping Rolling Releases and full OpenSSF Scorecard automation is the right call for a solo repo. The deps.dev / "discipline not a security org" framing is appropriately lean.

---

## BLOCKING findings

### B1 — `.env.example` snippet is fabricated (lines 32–38). ACCURACY.

The draft prints a four-line `.env.example` that includes:

```
# SANITY_API_READ_TOKEN=   # secret — server-only, set in Vercel + .env.local, never NEXT_PUBLIC_*
```

The **real** `.env.example` has only three lines and **no token line** (verified). The draft also reorders/relabels the comments. This is a doc inventing repo state — exactly the "stale memory presented as ground truth" failure the handbook is supposed to prevent. An agent will diff the snippet against the file, see a mismatch, and lose trust in the doc (or worse, "restore" the phantom line).

**Fix:** Either (a) drop the inline snippet and just _link_ `.env.example`, saying "today it holds the three public Sanity vars; when the token lands, add a commented `SANITY_API_READ_TOKEN=` line in the same commit" — or (b) clearly label the snippet **"after Phase 2 adds the token (illustrative — not current file contents)."** Option (a) is leaner and matches the "point, don't duplicate" house rule. The current line 36 also pins `NEXT_PUBLIC_SANITY_API_VERSION=2026-06-21`, which matches `env.ts`'s default — keep that value if you keep any snippet.

### B2 — `[D-proxy]` is not a real ADR (line 101). ACCURACY / CONSISTENCY.

The author already flagged this. Confirmed: `decisions.md` has D1–D23 and there is **no** `D-proxy`. Citing a non-existent anchor undermines the "[D#] = binding" contract the whole handbook leans on. The proxy-is-Node-only fact is real (the installed `proxy.md` states "Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files … Setting the `runtime` config option in Proxy will throw an error," and the changelog row `v16.0.0 | Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime") — it's just not a _decision_, it's a framework fact.

**Fix:** Drop `[D-proxy]`. Reword to anchor on the doc: "Aligns with the framework's own model — `proxy.ts` is Node-only too (`…/03-file-conventions/proxy.md`)." Anchor framework facts to bundled docs, decisions to `[D#]`. Never blur the two.

---

## HIGH findings

### H1 — "Edge runtime can't set the draft cookie" is unverified and probably the wrong reason (line 101). ACCURACY.

The draft asserts draft mode is "**Node runtime only** — the Edge runtime can't set the draft cookie." I searched the installed `draft-mode.md`: it documents the `__prerender_bypass` cookie and `Set-Cookie`, but says **nothing** about Edge being unable to set it. Edge route handlers _can_ set cookies. The real constraint here is upstream: **`proxy.ts` is Node-only** (B2), and **`next-sanity`'s `defineEnableDraftMode` takes a `SanityClient`** which you'll run server-side — but "Edge can't set the draft cookie" as stated is an unsupported framework claim that smells like model memory.

**Fix:** Replace with what's verifiable: "Implement the enable/exit handlers as **Route Handlers** (`app/api/draft-mode/enable/route.ts`), using `next-sanity`'s `defineEnableDraftMode`. They run server-side; don't try to drive draft mode from `proxy.ts` (Node-only, and not its job)." Drop the Edge-cookie assertion unless you can cite a doc line for it. If the intent is just "this is server-side, not client," say that.

### H2 — `X-Robots-Tag: noindex` during draft mode is asserted as a rule but not sourced (line 103). ACCURACY / RIGHT-SIZING.

The installed `draft-mode.md` does **not** mention `noindex` or `X-Robots-Tag` anywhere (verified — zero hits). The advice is _defensible_ (preview deploys shouldn't be indexed), but draft-mode preview content is served from a `*.vercel.app` preview URL behind a bypass cookie, which a crawler won't have — so the practical indexing risk is low, and Vercel preview deployments are already `noindex`'d at the platform level. Stated as a hard "send this header," it reads like invented framework lore.

**Fix:** Either source it (it's a general SEO practice, not a Next API — label it as such: "general practice, not a Next requirement") or soften to a one-liner: "Preview deploys are already `noindex` on Vercel; if you ever surface draft content on an indexable URL, set `X-Robots-Tag: noindex`." Don't present it as a framework rule.

### H3 — Vercel promote/rollback/`vercel rollback` mechanics are platform behavior the doc can't verify (lines 92–108). ACCURACY / RIGHT-SIZING.

The author already hedged this with "dashboard wins," which is good. But the section still states specifics as fact: "promotes instantly with no rebuild," "Instant Rollback re-aliases a previously-production deployment," `pnpm dlx vercel rollback`. These are Vercel platform behaviors, not in-repo truth, and Vercel changes its CLI/dashboard semantics without warning. For a solo portfolio where **merge-to-`main` auto-deploys** (the actual wired behavior), the promote/draft-preview-flow detail is the most speculative, least-load-bearing part of the doc.

**Fix:** Keep the hedge, but **trim hard**. The agent-useful core is three sentences: (1) merge to `main` = prod deploy, so `main` stays green; (2) if prod breaks, use Vercel's Instant Rollback from the dashboard, then fix-forward on a branch; (3) for exact promote/rollback steps, _link Vercel's docs_ rather than restating them. Cut the "promotes instantly with no rebuild" mechanism claim — it's the kind of detail that silently goes stale.

### H4 — Every relative link is broken from the draft's _current_ location (whole-tree caveat, not author error). CONSISTENCY.

From `docs/handbook/process/round-1-drafts/`, `../../architecture-plan.md` resolves to `docs/handbook/architecture-plan.md`, which doesn't exist (verified — all five sampled links 404). **However**, the sibling draft `engineering-standards.md` uses the _identical_ `../../architecture-plan.md` / `../../../AGENTS.md` convention, and the house-style spec says the handbook's final home is `docs/handbook/` (where `../architecture-plan.md` → `docs/architecture-plan.md` is correct). So these paths are written for the **final home**, and the whole round-1 tree shares the same offset.

**Fix (tree-wide, not this doc alone):** This is a process note for the synthesis/move step — when drafts graduate from `round-1-drafts/` to `docs/handbook/`, the depth resolves itself **only if** the spec'd `../` (not `../../`) depth is used. Right now siblings use `../../decisions.md`, which from `docs/handbook/` would be `docs/handbook/../../decisions.md` = repo-root `decisions.md` — also wrong. **Someone must pin the canonical final path depth once and make every sibling match.** Flag for the synthesizer; don't fix in isolation or this doc will drift from its siblings. This doc's `Anchors`/footer links (lines 112–117) inherit the same offset and need the same single fix.

---

## MEDIUM findings

### M1 — `SANITY_API_READ_TOKEN` name can be asserted, not hedged (lines 24, 37). ACCURACY.

The author's open question (2): the `next-sanity` helper's own JSDoc example uses `client.withConfig({ token: process.env.SANITY_API_READ_TOKEN })`. So `SANITY_API_READ_TOKEN` **is** the library's documented convention, not a guess. You can state it as the name we'll use (citing next-sanity), while still marking it "(not yet wired — Phase 2)." Keep the "(when added)" temporal hedge; drop any implication that the _name_ is uncertain.

**Fix:** "When draft mode lands we'll use `SANITY_API_READ_TOKEN` (the env var name `next-sanity`'s `defineEnableDraftMode` example uses) — server-only, never `NEXT_PUBLIC_*`."

### M2 — Anchors list cites [D17]/[D19] for the CI gate; double-check the mapping (line 79, 114). CONSISTENCY.

Line 79 cites `[D17][D19]` for "the CI gate is the guard." Verified: **D17** does put "CI gate (lint/format/typecheck/test/build on PRs)" in Phase 0, and **D19** schedules "CI in Phase 0." So both citations are legitimate — good. But the Anchors footer (line 114) labels D17 "risk-retirement guardrails" and D19 "CI gate," which is a slight mislabel: D19 is "cross-cutting concerns get scheduled where they belong" (CI is one example), and the CI-gate-in-Phase-0 line lives in _both_. Minor, but the handbook treats `[D#]` labels as authoritative.

**Fix:** Relabel the footer: `[D17]` "risk-retirement build sequence (CI gate in Phase 0)", `[D19]` "cross-cutting concerns scheduled (CI in Phase 0)." Precise labels keep the anchor contract trustworthy.

### M3 — `pnpm audit` "occasionally" is too vague to action (line 58). AGENT-USEFULNESS.

"`pnpm audit` occasionally and before a dependency-heavy PR" gives an agent no trigger it can evaluate. An agent doesn't know what "occasionally" or "dependency-heavy" means.

**Fix:** Tie it to a concrete event: "Run `pnpm audit` in any PR that changes `pnpm-lock.yaml`. Triage only _exploitable_ advisories that reach reachable code; ignore transitive dev-only noise." That's a rule an agent can check itself against.

### M4 — Two CWS facts could be made checkable. AGENT-USEFULNESS.

- §1's `grep -rn "NEXT_PUBLIC" src/` (line 47) is good — keep it. It's the one self-check command in the doc and exactly the right pattern.
- The CORS bullet (line 72) says "allow-list real origins only … never wildcard-with-credentials" but gives no _where_. For an agent, add: "Configured in Sanity → API → CORS Origins at [sanity.io/manage], not in repo." Otherwise an agent may hunt for a config file that doesn't exist.

---

## LOW / nits

- **Line 53** "Right-sized per OpenSSF/OWASP guidance" — fine, but neither OpenSSF nor OWASP publishes a single "dependency hygiene" doctrine you're citing; it reads as borrowed authority. Either name the specific source (OpenSSF _Concise Guide for Evaluating Open Source Software_, or OWASP _Dependency-Check_) or just say "right-sized: discipline, not a security org" and drop the standards name-drop. Accuracy over confidence (house rule).
- **Line 65** links `client.ts` for `useCdn: true` — verified correct, good anchor.
- **§4 table** is clean and accurate to the wired behavior; keep it. It's the most agent-useful artifact in §4.
- The doc never mentions the `git diff --exit-code sanity.types.ts` CI step (a real ops/security-adjacent gate in `ci.yml` — a drifted type file fails the build). Not required here (it's more a TypeGen/[D23] concern), but a one-line pointer "types are regenerated and diff-gated in CI [D23]" would round out the "deploy is boring because CI guards it" story. Optional.

---

## Summary of required changes (priority order)

1. **B1** — kill the fabricated `.env.example` snippet (the real file has 3 lines, no token); link the file or label the snippet "illustrative, post-Phase-2."
2. **B2** — drop `[D-proxy]`; reword the proxy-is-Node-only note to cite `…/proxy.md`, not a non-existent ADR.
3. **H1/H2** — remove the unsourced "Edge can't set the draft cookie" and the framework-flavored `X-Robots-Tag` rule, or relabel both as general practice with the real (server-side Route Handler) mechanism.
4. **H3** — trim the Vercel promote/rollback mechanics to the verifiable core (auto-deploy on merge; rollback from dashboard; link Vercel docs).
5. **H4** — flag the tree-wide relative-link depth for the synthesizer (don't fix this doc in isolation).
6. **M1–M4** — assert `SANITY_API_READ_TOKEN` (cite next-sanity), tighten the D17/D19 footer labels, make `pnpm audit` event-triggered, and point CORS config at sanity.io/manage.
