# 2026-06-27 — Phase 3 close-out: owner-gated wiring + live Item C sign-off

**Outcome:** ✅ **Phase 3 COMPLETE.** Two PRs — **#34** (pin the hosted-Studio host/appId) and **#35**
(this docs close-out) — plus the owner-gated ops that the build alone can't do: the hosted Studio
deployed, the revalidation webhook registered + verified, and **Item C** (the live draft-Presentation
walkthrough) finally run and signed off.

## Why

Phase 3's code had been done for days; what remained was **owner-gated** and **environment-side** — the
things a green build can't prove (registering the Sanity webhook, deploying the hosted Studio, wiring
Presentation, and actually watching a draft preview live). `build-phases.md` gated
the whole phase on **Item C** ("verify draft-content rendering end-to-end in Preview"), whose last step
was an authenticated, hosted-Studio walkthrough. This session ran all of it and closed the phase.

## Shape

**Solo lead, agent-driven**, no coding team — the work was ops + verification + docs, not parallel
slices. Tools: **claude-in-chrome** (the Sanity manage UI, the Vercel dashboard, the hosted Studio
Presentation), the **Sanity** + **Vercel MCP** servers, and the **Sanity CLI** (`sanity deploy`). One
small code change (the `sanity.cli.ts` pin) went through the normal branch → gate → PR → squash-merge;
the rest is ops recorded here + in the production checklist.

## Outcome

- **Hosted Studio deployed** → **https://jamiethompson-garden.sanity.studio** (`sanity deploy`). The
  deploy also pushed the **schema** to the Content Lake (`✔ Deployed 1/1 schemas`) — notable because
  `sanity deploy` (Studio) runs fine on the owner's darwin-x64 machine, whereas the standalone
  `sanity schemas deploy` SIGABRTs on Rolldown there (the reason schema deploy had been a CI-only step).
- **PR #34** (`47b3655`, squash-merged) — pinned `studioHost: 'jamiethompson-garden'` + `deployment.appId`
  in `studio/sanity.cli.ts` so the deploy is non-interactive/reproducible. (Discovered the hard way that
  the positional arg to `sanity deploy` is the **output dir**, not the host — the host must be pinned in
  config or typed at an interactive prompt.)
- **Revalidation webhook registered + verified** in sanity.io/manage — `POST <prod>/api/revalidate`,
  dataset `production`, Create/Update/Delete, filter `_type in ["project","siteSettings","note"]`, no
  projection, drafts/versions off, Secret = `SANITY_REVALIDATE_SECRET`. A real publish drove a
  **`200 {revalidated:true}`** in the attempt log.
- **`NEXT_PUBLIC_SANITY_STUDIO_URL`** set in Vercel (Production + Preview, non-sensitive) →
  the hosted Studio URL; production redeployed so the stega "open in Studio" deep links resolve.
  (`.env.local` kept at `http://localhost:3333` for local dev → local studio.)
- **Presentation → prod wired** — the hosted Studio redeployed with
  `SANITY_STUDIO_PREVIEW_URL=<prod>` baked in, so its Presentation iframes the live site. CORS was
  already complete (prod + localhost manual origins; the `*.sanity.studio` origin auto-added as a
  _managed_ origin by the deploy).
- **Item C — VERIFIED** (the gating sign-off): in the hosted Studio's Presentation (Drafts perspective,
  previewing prod), edited `goldenrod`'s **draft** blurb and watched the prod iframe **re-render the
  unpublished draft live**; counter-checked **no draft→published leak** (public `curl` showed the
  original); discarded the draft. Phase 3's last open item is closed.
- **[D27] retained** — owner's call (2026-06-27): keep the import-order hardening as cheap insurance
  despite the 2026-06-26 non-reproduction finding; D27 stands, not superseded. (Addendum on D27.)
- **Docs (PR #35, this one):** `build-phases.md` Phase-3 items flipped to done +
  "✅ PHASE 3 COMPLETE"; [`decisions.md`](../decisions.md) D27 addendum; [`README.md`](../../README.md)
  status → "Phases 0–3 complete"; `production-checklist.md` gained the two
  missing env vars (`SANITY_API_BROWSER_TOKEN`, `SANITY_REVALIDATE_SECRET`) and a **webhook-registration**
  step; this session record + index row.

## QA log [D26]

This session was verification-heavy; the QA _was_ the work (adversarial "don't trust the green state").

| Slice                   | Author | QA (fresh/adversarial?)                                                 | Verdict                     |
| ----------------------- | ------ | ----------------------------------------------------------------------- | --------------------------- |
| Webhook registration    | lead   | self, adversarial (checked the attempt log, didn't trust "saved")       | **2 defects found + fixed** |
| Item C walkthrough      | lead   | self, adversarial (positive + negative counter-check)                   | **clean**                   |
| PR #34 (host/appId pin) | lead   | live deploy + green gate (no separate fresh-agent pass)                 | clean — honestly labeled    |
| PR #35 (docs)           | lead   | accuracy review; every claim backed by this session's live verification | clean                       |

**Webhook defects** — 1) The first deliveries returned **`401 "Invalid or missing webhook signature."`**
The Secret field in the Sanity form is **collapsed behind a "Show secret" toggle** and is a **shadow-DOM
input** that browser automation could not reliably type/paste into — so it had silently stayed **empty**,
and an empty secret means Sanity sends **no** signature → 401. Caught by reading the attempt log (not
trusting the "Webhook saved" toast). → Fix: the **owner pasted** the secret directly; re-published →
**`200`**. 2) Before re-entering it, ruled out a Vercel/`.env.local` mismatch by signing a probe with the
`.env.local` secret via `@sanity/webhook`'s own `encodeSignatureHeader` and POSTing to prod → **`200`**,
proving `.env.local` == Vercel and isolating the fault to the webhook field. **Tests added:** none (the
endpoint's signature handling is already unit-tested in `src/app/api/revalidate/route.test.ts`; this was
an ops-config defect, not a code defect).

**Item C** — positive: the draft `[DRAFT PREVIEW TEST]` blurb **rendered live** in the prod iframe under
Drafts perspective. Negative (the case that matters): a public `curl https://<prod>/work/goldenrod` (no
draft cookie) while the draft existed showed the **original** blurb, **not** the marker — no leak. Then
discarded the draft and confirmed `draftExists: false` + original published blurb restored.

**Deferred:** none.

## Lessons

- **Don't trust the green/"saved" state — verify the effect.** Twice the surface lied: the webhook
  "saved" but delivered 401s (empty secret), and `sanity deploy <name>` cheerfully built to a directory
  named `<name>` instead of using it as the host. The attempt log and the actual deploy output were the
  truth.
- **Sanity's webhook Secret field can't be driven by automation** — it's behind "Show secret" and is a
  shadow-DOM input; keystrokes/paste don't land. Have a human paste secrets; never type a secret through
  an agent tool anyway (it would land in the transcript).
- **`sanity deploy` (Studio) ≠ `sanity schemas deploy`.** The former deploys the schema **and** works
  (locally on darwin-x64); the latter hits a Rolldown native **SIGABRT**. As of this session the SIGABRT
  also breaks the **`deploy-schema.yml` CI** on linux-x64 (it last passed 2026-06-25; the PR #31 lockfile
  move is the prime suspect) — so the PR #25 "schema deploy from CI" workaround is itself broken. The
  hosted-Studio `sanity deploy` is the working way to refresh the Content Lake schema. Tracked as a
  follow-up in `build-phases.md` ("CI / tooling regressions").
- **The hosted Studio's Presentation preview URL is build-time-baked** (`SANITY_STUDIO_PREVIEW_URL`): a
  bare `sanity deploy` reverts it to `localhost:3000`. Pass the prod URL each deploy (or wire a script).
