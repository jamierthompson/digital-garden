# R2 — Git / PR / CI workflow research

Research note for the handbook authors. Verified against primary sources (cited inline)
and this repo's ground truth (`.github/workflows/ci.yml`, `package.json`, `docs/decisions.md`,
the owner's binding conventions). Do not summarize this from memory — version-specific and
spec-specific facts are cited.

Anchors that matter here: **[D17]** (CI gate is a Phase-0 guardrail), **[D19]** (CI scheduled
in Phase 0), **[D23]** (two-package pnpm workspace → CI runs `pnpm --filter studio typegen`),
**[D10]** (key-drift check, stubbed now / live Phase 2), **§8** ("right-sized, not maximal").

---

## 1. Conventional Commits 1.0.0 (the owner's commit standard)

Primary spec: <https://www.conventionalcommits.org/en/v1.0.0/>

**Required structure** (quoted from the spec):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- **type** (required): a noun. `fix` (→ SemVer PATCH) and `feat` (→ SemVer MINOR) are the
  two the spec defines; others are allowed and have no implicit SemVer effect. The owner's
  set: `feat / fix / docs / style / refactor / test / chore`. The spec's wider catalog also
  includes `build`, `ci`, `perf` — fine to use, but keep to the owner's set for consistency.
- **scope** (optional): in parentheses, e.g. `feat(parser):`. Useful in this monorepo to
  signal package, e.g. `feat(studio):`, `chore(ci):`.
- **description** (required): short summary after `: ` (colon + space). Imperative mood,
  lower-case, no trailing period (community convention; the spec only mandates "short summary").
- **body** (optional): MUST begin one blank line after the description. The _why_.
- **footers** (optional): one blank line after the body. Token + `: ` or ` #` separator
  (git-trailer convention); tokens use `-` for spaces, e.g. `Reviewed-by`, `Refs`.

**Breaking changes** — two equivalent ways (use either; `!` MAY omit the footer):

1. `!` before the colon: `feat(api)!: drop legacy theme prop`
2. footer: `BREAKING CHANGE: <description>` (uppercase, literal).
   Either → SemVer MAJOR. This repo is `private`/pre-1.0 (`version: 0.1.0`, no release
   automation), so SemVer mapping is informational — but `feat!:` is still the right way to
   flag a breaking change for an agent reading the log.

**Repo conformance:** the existing log already follows this exactly —
`feat: enable Cache Components app-wide`, `chore: add CI gate …`, `docs: defer proxy.ts …`.
No commitlint tooling is installed; the rule is enforced by discipline/review, not CI.

## 2. Trunk-based development / short-lived branches

Primary: <https://trunkbaseddevelopment.com/short-lived-feature-branches/> ·
Atlassian: <https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development>

- The branch "should only last a couple of days. Any longer than two days, and there is a
  risk of the branch becoming a long-lived feature branch." Hours-to-a-day is ideal.
- Branches are **offshoots from main**, "destined to come back as 'pull requests' into the
  main/trunk," then deleted. Sync with main before merging back.
- "A few small commits" per branch; commits should "stay independent and capable of shipping
  individually."
- main is **assumed always stable and ready to deploy** (Atlassian). On Vercel that matters:
  every merge to main triggers a production deploy.
- For a solo, agent-driven repo the _model_ (short-lived branch + PR + green CI + delete)
  is exactly right and already the practice here; the "≥16 devs" framing in the sources is
  about _when teams must stop committing to trunk directly_ — not a reason to relax the
  owner's "never commit to main" rule, which CI/branch-protection enforces anyway.

**Repo conformance:** both merged PRs used short-lived branches
(`docs/plans-and-audit`, `feature/phase-0-foundation`) merged via PR and (per the merge-commit
naming) deleted. main is clean. This is textbook trunk-based-with-PRs.

## 3. Branch naming

Sources: <https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development> ·
<https://dev.to/shnjd/git-good-best-practices-for-branch-naming-and-commit-messages-oj4>

- Pattern `type/description` in **kebab-case**, lowercase alphanumerics + hyphens; it's
  URL-friendly and unambiguous. Keep under ~50–60 chars.
- Prefixes mirror the commit types: `feature/`, `fix/`, `chore/`, `refactor/`, `docs/`,
  `test/`, `ci/`. The owner's examples: `feature/add-user-authentication`,
  `fix/navbar-responsive-layout`, `chore/setup-eslint-config`.
- Optional CI guard regex if ever wanted:
  `^(feature|fix|chore|refactor|docs|test|ci)/[a-z0-9][a-z0-9-]*$` — **not currently
  enforced**; flag as optional, not a rule.

**Note the one inconsistency to encode:** the owner's branch prefixes are spelled out
(`feature/`, `fix/`) while commit _types_ are abbreviated (`feat:`, `fix:`). `feature/…`
branch + `feat:` commit is the intended pairing — call this out so agents don't write
`feat/…` branches or `feature:` commits.

## 4. PR hygiene & descriptions

Sources: <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/getting-started/helping-others-review-your-changes> ·
<https://graphite.com/guides/github-pr-description-best-practices> ·
<https://www.deployhq.com/blog/the-perfect-pull-request-best-practices-for-collaborative-development>

- **One PR = one purpose.** Don't mix refactor + bugfix + feature.
- **Size:** SmartBear's data shows review quality drops sharply past ~400 changed lines;
  target **<300 lines / ~15–20 min to review** (deployhq, citing SmartBear).
- **Title:** concise + informative; "Fix bug"/"Update code" force the reviewer to read the
  whole diff. A Conventional-Commit-style title doubles as the squash-merge subject.
- **Description should carry:** what changed, _why_ (motivation/context), how it was tested,
  any deploy considerations, linked issue. The owner's rule adds: write it "like a teammate
  will review them"; **no checklists with unfinished items** — all tasks done before opening.
- Even solo + agent-driven, the description is the durable record an agent reads cold later;
  it earns its place under §8's right-sizing.

**Repo conformance:** PR #2 "Phase 0 — Scaffolding + guardrails" is appropriately scoped to a
phase. Keep PRs to a phase or a coherent slice; one task ≈ one commit feeds clean squash or
readable merge.

## 5. CI-gate design

Sources: <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches> ·
<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>

General best practice:

- Branch protection / rulesets make passing CI a **merge gate** ("Require status checks to
  pass before merging"). Pair with "Require branches to be up to date before merging."
- **Job names must be unique across workflows** — duplicate names produce ambiguous required-
  status results that can block merges.
- **Keep checks fast**; run slow checks async. Optionally "Require linear history" for clean
  history (forces squash/rebase, blocks merge commits).
- Bypass permissions: limit, document, review after the fact.

### This repo's actual gate (`.github/workflows/ci.yml`)

Triggers on `pull_request` → `branches: [main]`. Single job `verify` on `ubuntu-latest`,
Node 22, pnpm via `pnpm/action-setup@v4`, `pnpm install --frozen-lockfile`. Public Sanity
`NEXT_PUBLIC_SANITY_PROJECT_ID` / `_DATASET` are set as plain env (correctly **not** secrets —
they ship to the browser). Steps, in order — **this is exactly what an agent must make pass
locally before pushing**:

| CI step                                                                 | Local command                  | Source of truth                                                                    |
| ----------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `pnpm lint`                                                             | `pnpm lint`                    | ESLint (`eslint-config-next` + `eslint-plugin-boundaries`; [D14]/[D21] boundaries) |
| `pnpm lint:css`                                                         | `pnpm lint:css`                | `scripts/check-css-layers.mjs` — the `@layer` trap [D12]                           |
| `pnpm lint:keys`                                                        | `pnpm lint:keys`               | `scripts/check-key-drift.mjs` — stubbed, live Phase 2 [D10]                        |
| `pnpm format:check`                                                     | `pnpm format` then commit      | Prettier                                                                           |
| `pnpm typecheck`                                                        | `pnpm typecheck`               | `tsc --noEmit`                                                                     |
| `pnpm test`                                                             | `pnpm test`                    | Vitest run [D18]                                                                   |
| `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | run typegen, commit the result | Sanity TypeGen drift gate [D23]                                                    |
| `pnpm build`                                                            | `pnpm build`                   | Next 16 / Turbopack prod build                                                     |

**To stay green, an agent must:**

1. Run `pnpm lint && pnpm lint:css && pnpm lint:keys && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` locally before pushing (mirrors CI exactly).
2. After any **Studio schema change**, run `pnpm --filter studio typegen` and **commit the
   regenerated `sanity.types.ts`** — CI fails on any diff (`git diff --exit-code`). This is
   the easiest gate to trip and forget.
3. Keep the lockfile honest — CI uses `--frozen-lockfile`, so commit `pnpm-lock.yaml`
   whenever deps change or install fails in CI.
4. Use `pnpm format` (write), not `format:check`, to fix; never hand-format.

**Gaps / notes for authors (don't overstate as configured):**

- The workflow file gates PRs, but whether **branch protection** actually _requires_ `verify`
  before merge is a GitHub repo setting not visible in-repo — recommend the authors state it
  as the intended config (require `verify`, require up-to-date branch, linear history) rather
  than as verified fact.
- The required check name to protect is the job id **`verify`**.
- No commitlint / branch-name CI guard exists — commit and branch conventions are
  discipline-enforced. Right-sized for solo; mention as optional, not a rule.
