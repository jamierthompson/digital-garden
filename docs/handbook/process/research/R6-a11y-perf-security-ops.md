# R6 — Accessibility, Performance, Security & Ops: verified standards

Research note for the handbook authors. Cites primary sources (URLs) and repo
ground truth. Version-specific framework facts are checked against the bundled docs
at `node_modules/next/dist/docs/`, not model memory. Anchors use `[D#]` (see
[`../../../decisions.md`](../../../decisions.md)) and `§N`
([`../../../architecture-plan.md`](../../../architecture-plan.md)).

Scope: lean, agent-relevant rules only. No governance theater.

---

## (a) Accessibility — WCAG 2.2, APCA/Lc, focus-visible

### WCAG 2.2 (the conformance target)

WCAG 2.2 (W3C Recommendation, Oct 2023) is the current stable version and the legal
baseline in most regions. Aim for **Level AA**. Criteria most relevant to this repo:

| SC                              | Level           | Rule                                                       | Repo touchpoint                   |
| ------------------------------- | --------------- | ---------------------------------------------------------- | --------------------------------- |
| 1.4.3 Contrast (Minimum)        | AA              | Text ≥ 4.5:1 (large text/UI 3:1)                           | Engine compliance fallback `[D4]` |
| 1.4.11 Non-Text Contrast        | AA              | UI components & focus indicators ≥ 3:1                     | Focus-ring color `[D7]`           |
| 2.4.7 Focus Visible             | AA              | Keyboard focus must be visible                             | `:focus-visible` policy `[D7]`    |
| 2.4.11 Focus Not Obscured (Min) | AA (new in 2.2) | Focused element not fully hidden by sticky/overlay content | Shell nav, any sticky header      |
| 2.5.8 Target Size (Min)         | AA (new in 2.2) | Pointer targets ≥ 24×24 CSS px (or adequately spaced)      | Nav links, cards, embed controls  |
| 2.4.13 Focus Appearance         | AAA             | ≥ 2px perimeter, ≥ 3:1 focused-vs-unfocused                | Stretch goal for focus geometry   |

Sources: [What's New in WCAG 2.2 (W3C/WAI)](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/),
[WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/).

### APCA / Lc contrast (the perceptual target)

APCA reports **Lc** (lightness contrast), perceptually uniform 0–~106; Lc 60 reads the
same regardless of light/dark mode. It is the _candidate_ method for the future WCAG 3,
which is **years away (placeholder status; ~2030 at earliest)** — so APCA is **not a
legal substitute** for WCAG 2.x today. Recommended Lc thresholds:

- **Lc 90** — preferred for fluent body text (≥ 18px/300 or 14px/400).
- **Lc 75** — minimum for columns of body text.
- **Lc 60** — minimum for other content (non-body) text.
- **Lc 45** — headlines / large text; fine-detail icons.
- **Lc 30** — spot-readable: placeholders, disabled elements, solid icons.
- **Lc 15** — floor for any non-text element; treat below this as invisible.

Sources: [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html),
[WCAG3 Contrast as of April 2026 — Adrian Roselli](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html).

**How this maps to the repo's engine ("contrast solved, not stepped" — §3.2, `[D4]`):**
The engine takes a **contrast target** and binary-searches lightness `L` for on-brand /
on-surface pairs against the _relevant background_, evaluated on the **gamut-mapped** color
(`[D6]` — gamut-map before contrast math). Use **APCA Lc as the primary text target, with
WCAG 2.x ratios as the compliance fallback** (exactly `[D4]`). Fixed ΔL offsets are
forbidden — equal ΔL ≠ equal contrast across hues. Re-solve per scheme (`[D5]`); the
Phase-1 visual harness asserts contrast in **both** light and dark.

### focus-visible

Use **`:focus-visible`**, not bare `:focus`, so the ring shows for keyboard/AT users but
not on mouse click (WCAG technique C45). Geometry (width, offset, style) is **global**
coordination; ring **color** is engine-emitted per island surface `[D7]`. Never
`outline: none` without an equivalent visible replacement. Ring must clear ≥ 3:1
(1.4.11). For old engines, mirror the rule inside `@supports not (selector(:focus-visible))`.

Sources: [MDN :focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible),
[W3C technique C45](https://www.w3.org/WAI/WCAG21/Techniques/css/C45).

---

## (b) Performance — Core Web Vitals & the font-preload policy

### Core Web Vitals budgets ("good" at the 75th percentile, mobile + desktop)

| Metric                              | "Good" threshold |
| ----------------------------------- | ---------------- |
| **LCP** (Largest Contentful Paint)  | ≤ **2.5 s**      |
| **INP** (Interaction to Next Paint) | ≤ **200 ms**     |
| **CLS** (Cumulative Layout Shift)   | ≤ **0.1**        |

INP replaced FID as a stable CWV in 2024. Evaluate at the **75th percentile** across both
form factors; LCP is the hardest to pass. Sources:
[web.dev Web Vitals](https://web.dev/articles/vitals),
[web.dev defining CWV thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds).

**Repo-specific performance levers (already decided):**

- **Index query refuses to over-fetch** (§6) — `/work` pulls `blurb`/`brandColor`/`fontKey`,
  never the essay → small index payload protects LCP.
- **Prerendered shell + streamed holes (PPR)** via Cache Components `[D11]`, §7 — themed
  `<style>` + font class in initial static HTML (flash-free); essay/notes stream.
- **Zero-CLS fonts**: `next/font` size-adjusted fallback kills layout shift; per-project
  display face swaps intentionally on nav (§5). Protects CLS.
- **CWV/perf pass is Phase-4 verification** `[D17]`, not an early gate.

### Font-preload policy (`[D11]`, §5) — the load-bearing, counter-intuitive rule

- **`preload: false` on every roster face** (the `next/font` default is `true`, so this
  must be set explicitly). Only the **1–2 shell faces** in the root layout get
  `preload: true` (they apply on every route).
- **Why per-project faces can't be preloaded:** `next/font` preload injection is a
  **build-time static transform** keyed to a _statically referenced_ font object.
  `roster[fontKey].variable` is a **runtime index** Next can't target — this is a
  _static-analyzability_ question, **not** SSG-vs-dynamic (that route toggle is gone under
  Cache Components). Caching bakes the resolved className into HTML but emits **no**
  `<link rel=preload as=font>` for a face it couldn't statically identify.
- Per-project faces are **applied, not preloaded** (`.variable` on `[data-project]`,
  `--logx-font` maps to it); they tolerate `font-display: swap` below the fold.
- If an above-the-fold project face genuinely must preload, **emit
  `<link rel="preload" as="font" crossorigin>` manually.**
- **Verify empirically:** `pnpm build` → visit `/work/<slug>` → view-source `<head>` →
  count `<link rel="preload" as="font">` (expect shell faces only). This is a Phase-0.5
  inspection, not a decision.
- Prefer **variable fonts** (one file, many weights).

---

## (c) Security — secrets/env, dependency hygiene, Sanity tokens

### Secrets & environment variables

- **Never commit secrets**; env vars only; keep `.env.example` current; `.env*` gitignored
  (owner standard; repo already complies — `.env.example` present).
- **`NEXT_PUBLIC_*` is shipped to the browser** — only non-secret values. The repo's Sanity
  **project ID and dataset are public by design** (they're in `NEXT_PUBLIC_*` and even
  hardcoded in `ci.yml`'s non-secret env). A **read/write API token is a secret** and must
  live only in Vercel env vars / local `.env.local`, never in `NEXT_PUBLIC_*` or any client
  bundle.

### Dependency hygiene (OpenSSF / OWASP basics — right-sized)

- **Deterministic installs from the lockfile.** CI already runs
  `pnpm install --frozen-lockfile` (pnpm's `npm ci` equivalent) — this enforces lockfile
  integrity and hash-pinning. Commit `pnpm-lock.yaml`.
- **Audit dependencies**: `pnpm audit` for known CVEs; check a new dependency's posture via
  [OpenSSF Scorecard](https://scorecard.dev/) / [deps.dev](https://deps.dev) before adding.
- **Pin GitHub Actions and prefer least-privilege tokens** (Scorecard checks: Pinned-
  Dependencies, Token-Permissions). The repo pins major action versions (`@v4`).
- **Consider `ignore-scripts`** to blunt malicious postinstall scripts (OpenSSF npm
  guidance) — note this can break packages that need build steps; verify before enabling.
- Keep it lean: a solo portfolio repo does **not** need full Scorecard automation; `pnpm
audit` + frozen lockfile + Dependabot/Renovate (optional) is proportionate.

Sources: [OpenSSF package-manager-best-practices (npm)](https://github.com/ossf/package-manager-best-practices/blob/main/published/npm.md),
[OpenSSF Scorecard](https://github.com/ossf/scorecard),
[Sanity — Keeping your data safe](https://www.sanity.io/docs/content-lake/keeping-your-data-safe).

### Sanity token handling

- **Tokens are write-capable destruction risk.** Anyone with a write token can delete all
  data. Treat a leaked token as **permanently compromised** — delete/rotate immediately.
- **Never bundle a token into client JS.** Token-bearing reads happen **server-side only**
  (RSC / route handlers). Per `[D23]`, the Next app uses `next-sanity` for fetching / Live
  Content / Visual Editing only; the Studio is a separate workspace package.
- **Production client perspective: `published`** — excludes drafts. Draft content is only
  fetched under authenticated draft mode (below).
- **CORS**: in the Sanity project, allow only your real origins (localhost + the Vercel
  domains). Adding a token sets `withCredentials: true`, which needs "Allow credentials"
  per-origin — **never** allow credentials from a wildcard origin.

Sources: [Sanity browser security & CORS](https://www.sanity.io/docs/content-lake/browser-security-and-cors),
[Sanity auth & tokens](https://www.sanity.io/docs/content-lake/http-auth),
[Sanity Learn — token handling & security](https://www.sanity.io/learn/course/visual-editing-with-next-js/token-handling-and-security).

---

## (d) Ops — the Vercel deploy model

Bundled-doc cross-check for draft mode:
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/draft-mode.md` and
`01-app/02-guides/draft-mode.md` (version-matched). `draftMode()` is **async** under
Next 16 (request API).

### Preview vs production

- **Preview deployment** = any deploy never aliased to the production domain (every push /
  PR branch gets one, with **preview** env vars).
- **Production deployment** = aliased to the production domain (uses **production** env
  vars). Promoting flips which env-var set is used.
- **Promote**: a preview/staged build can be promoted to production **instantly (no
  rebuild)** if it was built for production; otherwise a rebuild runs.

### Draft mode (Sanity preview)

- `next-sanity/draft-mode`'s `defineEnableDraftMode` creates the **enable** route; it
  validates a **secret** and calls `draftMode().enable()` (sets a cookie). Add a matching
  **exit/disable** route (`draftMode().disable()`) for the Studio's "stop preview" button.
- **Node runtime only** — Edge can't set the draft-mode cookie (and `proxy.ts` is Node-only
  here anyway, §7).
- Send **`X-Robots-Tag: noindex`** on any response served while draft mode is enabled so
  draft content is never indexed.

Sources: [Next.js Draft Mode guide](https://nextjs.org/docs/app/guides/draft-mode),
[Sanity Visual Editing with Next.js App Router](https://www.sanity.io/docs/visual-editing/visual-editing-with-next-js-app-router).

### Rollback & rolling releases

- **Instant Rollback**: re-aliases an **already-production-eligible** deployment — fast
  incident recovery, no rebuild. Preview deployments (never aliased to production) are
  **not** eligible. Hobby plan rolls back to the _previous_ deployment; Pro/Enterprise to
  _any_ eligible one. CLI: `vercel rollback`.
- **Rolling Releases** (gradual %-based rollout) exist but are **overkill** for a solo
  portfolio — note as available, not recommended.

Sources: [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback),
[Vercel Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment),
[Vercel Rolling Releases](https://vercel.com/docs/rolling-releases).

---

## Pitfalls (agent quick-list)

1. **APCA is not legal cover** — ship WCAG 2.x AA as the floor, use APCA Lc as the _quality_
   target. Don't claim "WCAG 3 compliant."
2. **Contrast must be solved on the gamut-mapped color** (`[D6]` before `[D4]`), and
   **re-solved per scheme** (`[D5]`) — not one ratio reused across light/dark.
3. **Don't expect per-project fonts to preload** — runtime `fontKey` defeats build-time
   static analysis (`[D11]`). Verify the `<head>` empirically.
4. **`outline: none` without a visible replacement** fails 2.4.7 — always pair with a
   `:focus-visible` ring ≥ 3:1.
5. **Never put a Sanity token in `NEXT_PUBLIC_*` or client code.** Production perspective =
   `published`. No wildcard CORS-with-credentials.
6. **Draft-mode routes are Node-runtime**, need a secret, an exit route, and `noindex`.
7. **Sticky shell nav can obscure focus** — watch 2.4.11; **tap targets ≥ 24px** — watch
   2.5.8 on nav/cards/embed controls.
