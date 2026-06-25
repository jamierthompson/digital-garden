# Devil's-Advocate Critique — "Working With Agents" (Round 1 draft)

Reviewer: adversarial. Target: `docs/handbook/process/round-1-drafts/working-with-agents.md`.
Everything below was spot-checked against the **installed** bundled docs in
`node_modules/next/dist/docs/`, `docs/decisions.md`, the `docs/audit/` trail, and the
sibling drafts in `process/round-1-drafts/`. Verdicts: **BLOCKER** (fix before merge),
**SHOULD-FIX**, **NIT**, **CONCEDE** (it's good, leave it).

---

## Headline

This is a strong, well-anchored draft — it correctly identifies "cite, don't remember" as
the load-bearing rule, the link depths are right for the final `docs/handbook/` location,
and the sibling/audit references all resolve. But the **verify-before-write table in §1 —
the single most important artifact in the doc — sends agents to bundled-doc paths that do
not contain two of the six stated facts.** That is the exact failure mode the doc exists to
prevent, and it's the top thing to fix. Two more framework claims are over-stated (need a
"when cacheComponents is enabled" scope). The right-sizing is mostly excellent; a couple of
citations are doing more decoration than work.

---

## 1. ACCURACY

I verified all six rows of the §1 table and the §2 trap list against the installed docs.

### BLOCKER A — Two table rows cite a doc that does not contain the stated fact

The §1 table's whole promise is "Verify in: `<path>`." For two rows, an agent who opens the
cited path finds **nothing** about the rule — which trains agents to distrust the table, the
opposite of the goal.

- **CSS-Modules-auto-layered row → cites `…/11-css.md`.** I grepped the installed
  `01-app/01-getting-started/11-css.md`: the string `@layer` **does not appear anywhere in
  it**, and `grep -rl '@layer' 01-app/` returns **no files at all**. The doc's CSS Modules
  section (line 188+) describes local scoping via generated class names and says nothing
  about cascade layers or that an unlayered module outranks `@layer` styles. The fact is
  _true_ — it's CSS-spec cascade behavior plus the fact that Next doesn't auto-assign a
  layer — but it is **not a documented Next fact**, it's empirical/spec behavior. Note this
  is the **same mis-citation that [D12] makes** ("verified against
  `node_modules/next/dist/docs/.../11-css.md`"); the draft inherited it. The draft is bound
  by [D12], but it should not propagate a citation an agent can't verify.
  - **Fix:** change the "Verify in" cell to the project's own enforcement —
    `scripts/check-css-layers.mjs` and **[D12]** — and label the fact as _CSS cascade spec +
    Next's no-auto-layer behavior, confirmed empirically by the Phase-0.5 `<head>`/cascade
    check (D17)_, not as something `11-css.md` states. If you keep a bundled-doc pointer at
    all, point to where Next _does_ discuss Modules (`11-css.md` §"CSS Modules") and say
    explicitly "the layer behavior is not in this doc; it's spec behavior we lint for."

- **Templated-dynamic-import row → cites `…/lazy-loading.md`.** I grepped
  `01-app/02-guides/lazy-loading.md`: it shows **literal** `() => import('../components/A')`
  in every example (lines 37-39, 83, 138) but **never** states that a _templated_ import
  defeats static analysis (`grep -ciE 'literal|templated|backtick' → 0`). That's a
  bundler (Turbopack/webpack) static-analysis fact, codified here by **[D21]**, not a claim
  the Next lazy-loading doc makes.
  - **Fix:** cite **[D21]** as the authority and frame the doc link as "examples of the
    literal form" rather than "verify the rule here." The rule's home is [D21] + the
    bundler's static-analysis behavior, not `lazy-loading.md`.

This generalizes to a **method note the doc should add**: some of these footguns are
_documented Next behavior_ (async request APIs, proxy runtime, `use cache` + request APIs)
and some are _spec/bundler behavior the repo lints for_ (CSS layers, literal imports). The
table currently presents all six as "verify in a bundled doc," which is only true for four
of them. Split the column or annotate which is which.

### BLOCKER B — "`export const dynamic` … Removed" is unscoped and therefore wrong-as-written

The table says `export const dynamic` is **"Removed."** flatly. The installed docs are more
precise: route-segment-config `index.md` line 19 reads _"`dynamic`, `dynamicParams`,
`revalidate`, and `fetchCache` removed **when Cache Components is enabled**."_ The
`migrating-to-cache-components.md` doc frames it as _"replaced by `use cache`"_ /
_"Not needed. All pages are dynamic by default."_ The `dynamic.md` segment-config page is
indeed gone from the installed tree (the dir now holds only `dynamicParams`, `instant`,
`maxDuration`, `preferredRegion`, `runtime`), but the removal is **conditional on
`cacheComponents`**.

Here it doesn't matter operationally because this repo enables `cacheComponents` app-wide
([D11]) — so for _this repo_ "removed" is the lived reality. But the doc states it as a
universal Next-16 fact, which is the kind of imprecision the doc itself warns against.

- **Fix:** "**Removed under `cacheComponents`** (enabled app-wide here — [D11]). Replaced by
  `use cache` + `cacheLife`; pages are dynamic-by-default." That's both accurate and
  on-message. ([D11] already says exactly this; mirror its phrasing.)

### CONCEDE — these four rows/claims are accurate against the installed docs

- **Async request APIs.** Verified: `cookies.md` line 6/67 ("**async** function… You must
  use `async/await`"), `draft-mode.md` line 11 ("**async** function"). Correct.
- **`use cache` cannot read request APIs; read outside and pass as args.** Verified verbatim:
  `use-cache.md` line 196 ("Cached functions and components **cannot** directly access
  runtime APIs like `cookies()`, `headers()`… read these values outside the cached scope and
  pass them as arguments"), line 85 ("captured and bound as arguments… part of the cache
  key"). The draft's "(args = cache key)" parenthetical is exactly right. Strong row.
- **`proxy.ts`, Node runtime only, setting `runtime` throws.** Verified: `proxy.md` line 223
  ("Proxy defaults to using the Node.js runtime. The `runtime` config option is not
  available… Setting the `runtime` config option in Proxy will throw an error"), changelog
  line 774 ("`v16.0.0` Middleware is deprecated and renamed to Proxy"). Correct.
- **PPR "prerendered shell + dynamic holes."** Consistent with `migrating-to-cache-components.md`
  ("the prerendering step automatically extracts the static HTML shell") and [D11]. Correct.

### SHOULD-FIX — external-standard claims: mostly sound, two to tighten

- **`AGENTS.md` "stewarded by the Agentic AI Foundation under the Linux Foundation," "works
  across 20+ tools."** I could not verify either the stewardship attribution or the exact
  "20+" count from in-repo ground truth, and both are the sort of moving-target claim that
  dates fast. The house style says "state it as that standard, with accuracy over
  confidence." **Recommend** softening to "an open, vendor-neutral convention (`agents.md`)"
  and dropping the specific governance body + tool count unless you can cite a primary source
  in-line. The _functional_ claim ("README = humans; AGENTS.md = agent context; nearest file
  wins") is correct and sufficient — that's what an agent needs.
- **The two arXiv citations (`2511.12884`) — "~14.5% prevalence each" for security/perf
  blind spots, and ">20% cost increase from LLM-generated context files."** These are doing
  real persuasive work (they justify §2's "hold the line" and §3's "keep it lean"). Two
  risks: (a) a single preprint cited twice for two different load-bearing numbers is thin
  evidence to hang behavioral rules on; (b) precise percentages from one preprint read as
  more settled than they are. **Recommend** keeping the _behavioral_ rules (they're good and
  independently justified) but demoting the stats to "research suggests…" rather than hard
  percentages, or cite a second source. Don't let a portfolio handbook's credibility ride on
  one preprint's exact numbers.
- **CONCEDE — the rest are correctly attributed:** ADR immutability → Nygard/Fowler (right),
  Conventional Commits, Anthropic multi-agent (the ~15× cost and "sharper prompt not more
  agents" both come straight from that post), Ewerlöf on fake-consensus, Claude Code
  subagents fresh-context. The ofox.ai "Skill/Hook/Subagent" rule-of-thumb is a blog, not a
  standard — fine as a mnemonic, but it's the weakest source in the doc; consider dropping
  the citation and keeping the mnemonic as house phrasing.

---

## 2. RIGHT-SIZED vs OVER-ENGINEERED

This is the draft's strongest axis. It genuinely resists governance theater, and §3's "do
not restate what CI/configs already enforce… state a rule once, point to the gate" is
exactly the right doctrine for this repo. A few trims:

- **SHOULD-FIX — §4 + §5 + §6 overlap on the same handoff lesson.** "Context doesn't carry
  across the handoff; brief self-contained, return a dense digest" is stated in §4 (research
  bullet), §5 (whole section), and §6 (first bullet). That's the right lesson but it's said
  three times. **Recommend** consolidate the mechanics into §5 and have §4/§6 cross-reference
  it rather than re-teach it. Tightening here directly serves the "keep it lean" rule the doc
  preaches.
- **NIT — §4's "~15× token cost" gate is good; make the trigger test sharper.** "architecture-
  class decisions only" is then defined by a 4-part list (hard to reverse / crosses a
  boundary / locks an external contract / contradicts the plan or a [D#]). Good. But an agent
  landing cold still needs a _default_: state plainly "**Default to single-agent. Reach for
  the five-lens pattern only when ≥1 of these is true.**" The draft implies it; say it.
- **CONCEDE — the brief explicitly asked for the five-lens pattern, the two pitfalls, and the
  worked `audit/` example, and the draft delivers all three crisply and points at the real
  artifacts.** No padding. The "3–5 concurrent sweet spot" and "route hard reasoning to a
  stronger model" are concrete and actionable. Keep.
- **CONCEDE — no Code of Conduct, no SLAs, no contributor governance.** The draft honored the
  brief's "cut ruthlessly" mandate. Good.

---

## 3. CONSISTENCY (against the 23 decisions, the plan, sibling docs)

No contradictions with the decisions found — the draft cites [D9], [D11], [D12], [D14],
[D16], [D21], [D23] and each citation matches the decision's actual content. Two precision
issues and one duplication risk:

- **BLOCKER (cross-ref) — §2 cites "the font-preload policy ([D11])" but earlier in the same
  bullet writes "(gone — [D11])" for `export const dynamic`. Both are [D11], which is
  correct** (D11 covers both fonts _and_ the cacheComponents/dynamic story). **But §1's table
  cites the dynamic-removal to "`cacheComponents.md`, `08-caching.md`."** There is **no
  `08-caching.md`** under `01-app/` in the installed tree (caching guidance lives in
  `02-guides/caching-without-cache-components.md` and `migrating-to-cache-components.md`, and
  the segment-config removal note is in `…/02-route-segment-config/index.md`). **Fix the
  path:** cite `…/02-route-segment-config/index.md` (the removal note) and/or
  `migrating-to-cache-components.md`. `08-caching.md` looks like stale-memory path
  invention — exactly what the doc warns against, ironically in the verify-this row.
- **SHOULD-FIX — §1 row for async APIs cites "`…/05-server-and-client-components.md`."** The
  installed getting-started file is `04-server-and-client-components.md` (the `05-` numeric
  prefix is wrong in this tree). Re-point to the canonical function pages you already cite
  (`04-functions/cookies.md`, `…/draft-mode.md`) which I verified contain the async fact;
  drop the mis-numbered server-components path.
- **NIT — duplication of the architecture model.** The draft mostly _points_ rather than
  restates (good). The one place it edges toward restating the system is §1's PPR
  parenthetical and §2's "OKLCH engine / isomorphism" trap examples. These are fine as
  _traps_ (they tell an agent what not to do) but make sure they don't drift into explaining
  _how_ the engine works — that's `architecture-plan.md`'s job. Currently OK; flag for the
  synthesis pass.
- **CONCEDE — sibling links all resolve.** `./decision-records.md`,
  `./git-and-pr-workflow.md`, `./definition-of-done.md`, `./accessibility-and-performance.md`,
  `./security-and-ops.md`, `./orientation.md`, `./engineering-standards.md` all exist as
  round-1 drafts (→ future `docs/handbook/` siblings). The author's open question (a) —
  siblings vs `process/` placement — **resolves in favor of siblings**: every other draft
  sits flat in `round-1-drafts/`, i.e. flat in `docs/handbook/`, so `./decision-records.md`
  is correct. `../audit/round-2-debate.md` and `../audit/synthesis.md` both exist and the
  audit README confirms those exact filenames. Link depths are right for the final location.

---

## 4. AGENT-USEFULNESS

Would a cold agent follow this and ship cleaner code? Mostly yes — it's imperative,
skimmable, and checklist-driven. Gaps:

- **BLOCKER (usefulness) — same as §1 BLOCKER A:** the §7 self-check says "I verified it
  against `node_modules/next/dist/docs/`." An agent that takes the §1 table at face value
  and opens `11-css.md` or `lazy-loading.md` to "verify" the layer/literal-import rules will
  find nothing and either (a) conclude the rule is wrong, or (b) waste a turn. The table must
  point each fact at a source that _actually contains it_. This is the single highest-impact
  fix for agent usefulness.
- **SHOULD-FIX — give the verify step a copy-pasteable command.** The doc says "confirm
  against the bundled docs" but never shows _how_ to search them. Add one line agents will
  actually use, e.g.:
  ```bash
  # Verify a framework fact against the installed docs (not memory):
  grep -rniE 'cookies|async' node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md
  ```
  A concrete grep recipe turns "cite, don't remember" from a slogan into a muscle-memory
  action. This is the doc's central rule; make it executable.
- **SHOULD-FIX — §5 brief checklist is good but missing "model/tier to use."** It lists
  Objective/Sources/Boundaries/Output/cite-rule but the prose above it says "route hard
  reasoning to a stronger model." Add a checklist line: "**Model tier** — name it if the
  subtask needs stronger reasoning vs. a cheap fetch." Otherwise the cost-control advice in
  the prose never makes it into the actual template an agent copies.
- **NIT — §7's green-gate command duplicates §3's gate list.** Fine to repeat the _command_
  once as the canonical copy-paste (it's load-bearing), but ensure the script list matches
  `package.json` exactly. I checked: `lint`, `lint:css`, `lint:keys`, `typecheck`, `format`,
  `format:check`, `test`, `build` all exist; `pnpm --filter studio typegen` is correct for
  the workspace ([D23]). **One caveat:** there is **no `typegen` script in the root
  `package.json`** and the `studio/` package isn't in this repo yet (handbook is being
  written ahead of Phase-2 Studio work). The command is forward-looking — fine, but consider
  a parenthetical "(once `studio/` lands)" so an agent today doesn't try to run a script that
  doesn't exist.
- **CONCEDE — the §5 "fresh isolated context" framing is accurate and high-value.** It's the
  #1 thing agents get wrong about subagents, stated plainly. The "Skill teaches / Hook
  enforces / Subagent isolates" mnemonic is genuinely useful orientation. Keep both.
- **CONCEDE — §2's "if your instinct contradicts a [D#], you're probably on stale memory —
  stop" is the best single sentence in the doc.** It converts the abstract "decisions are
  binding" into an actionable interrupt. Keep verbatim.

---

## Priority fix list (for the synthesis pass)

1. **[BLOCKER] Re-source the two unverifiable table rows** (CSS `@layer` → [D12] +
   `check-css-layers.mjs`; templated import → [D21]). Annotate which footguns are _documented
   Next behavior_ vs _spec/bundler behavior the repo lints for_.
2. **[BLOCKER] Fix invented/mis-numbered doc paths:** `08-caching.md` →
   `…/02-route-segment-config/index.md` + `migrating-to-cache-components.md`;
   `05-server-and-client-components.md` → `04-…` (or drop, keep the verified function pages).
3. **[BLOCKER] Scope the `dynamic` claim:** "Removed **under `cacheComponents`** (enabled
   app-wide here — [D11])," not flatly "Removed."
4. **[SHOULD-FIX] Soften unverifiable external claims:** `AGENTS.md` governance/"20+ tools";
   demote the arXiv percentages to "research suggests." Keep the behavioral rules.
5. **[SHOULD-FIX] Add a copy-pasteable `grep` recipe** for verifying a fact against the
   bundled docs, and a **Model-tier** line to the §5 brief checklist.
6. **[SHOULD-FIX] De-duplicate** the "self-contained in / dense digest out" lesson across
   §4/§5/§6 into one home.
