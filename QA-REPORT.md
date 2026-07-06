# Adversarial QA — slice #173 (per-page theme seeds + required brandColor)

**Reviewer:** fresh QA agent, no prior context of this slice.
**Branch:** `qa/sanity-seeds` @ base `5922a0e`.
**Verdict:** **2 real defects found**, both sharing one root cause in `ENTRY_DETAIL_QUERY`.
Both are pinned with fail-first, groq-js-executed tests. 11 further hardening tests added
(all green). Rest of the gate is green.

---

## Findings, most severe first

### F1 (HIGH) — Empty-string `brandColor` on a `now` entry silently unthemes the page

**Root cause.** `ENTRY_DETAIL_QUERY` resolves the page's single theme seed with:

```groq
"themeSeed": coalesce(brandColor, *[_type == "siteSettings"][0].pageThemes.now)
```

GROQ `coalesce(a, b)` returns the **first non-null** operand. An empty string `""` is
**not null**, so `coalesce("", …)` returns `""` — it does **not** fall through to the `/now`
page seed. Verified by executing the real query with `groq-js`:

| `now` entry `brandColor` | `themeSeed` | Expected (per code comments) |
|---|---|---|
| absent | `"#NOWSEED"` ✅ | `/now` seed |
| `null` | `"#NOWSEED"` ✅ | `/now` seed |
| `""` (empty) | **`""`** ❌ | `/now` seed |

**Reachability — `""` is a valid, unblocked value for a `now` entry.** Both author-time
guards on `brandColor` pass an empty string for `kind: "now"`:

- `requiredForThemedKind` exempts `now` (`now ∉ THEMED_KINDS`), so `""` is never "required".
- `isBrandColorString("")` returns `true` (`if (!value) return true` — empty is explicitly
  allowed, deferred to `.required()` which never runs for `now`).

So a `now` entry written with `brandColor: ""` — the API/import path `colorValidation.ts`
itself calls out as a real threat ("edited via the API, not the Studio UI") — publishes
clean and renders an **unthemed page** with `themeSeed === ""`. The query's own comment
("a `now` entry has none and falls through to the authored `/now` page seed") is false for `""`.

**Why it matters.** This is exactly the flash-free-theming invariant #166 is built to protect,
defeated silently: no error, no fallback, an empty seed handed to the downstream consumer (#175).

**Pinned by (fails first):**
`src/sanity/lib/queries.test.ts` → *"a now entry with an EMPTY-STRING brandColor still
inherits the /now seed (empty-string coalesce hole)"* — `expected '' to be '#105060'`.

---

### F2 (HIGH) — A `now` entry's own `brandColor` overrides `/now`, contradicting "ignored downstream"

**Root cause — same `coalesce`.** The query themes by **presence of `brandColor`**, but the
design requires a `now` entry to **always** wear the `/now` seed regardless of its own field.
`entry.ts` states this explicitly:

> "`now` … carries no brandColor and inherits the `/now` page seed (resolved in
> ENTRY_DETAIL_QUERY); **any theming fields set on it are ignored downstream**."

The query does **not** ignore them. Verified with `groq-js`:

| `now` entry `brandColor` | `themeSeed` | Design contract |
|---|---|---|
| `"#OWNCOLOR"` | **`"#OWNCOLOR"`** ❌ | `/now` seed ("ignored downstream") |

A `now` entry carrying a `brandColor` is not hypothetical: the schema field is neither
`hidden` nor forbidden for `now`, and the existing suite explicitly blesses it
(`entryValidators.test.ts` → *"ACCEPTS a brandColor set on a now update — set-but-ignored,
never rejected"*). "set-but-ignored" is the stated contract; the query makes it
**set-and-used**, so such a `now` update wears a **different** theme than the `/now` index —
breaking the "a now update wears the same theme as the `/now` index" promise in `queries.ts`.

**Pinned by (fails first):**
`src/sanity/lib/queries.test.ts` → *"a now entry that carries its OWN brandColor still wears
the /now seed (now theming is 'ignored downstream')"* — `expected '#f97316' to be '#105060'`.

**Shared fix (author's call).** Both F1 and F2 are closed by making the `now` seed
**kind-gated** instead of presence-gated, e.g.:

```groq
"themeSeed": select(kind == "now" => *[_type == "siteSettings"][0].pageThemes.now,
                    coalesce(brandColor, *[_type == "siteSettings"][0].pageThemes.now))
```

or by preventing a `now` entry from persisting a `brandColor` at all. **Alternatively**, if the
team decides a `now` entry *may* opt into its own color and empty is truly unreachable, then the
fix is to the **comments/tests** (they currently over-promise) — but that leaves F1's silent-`""`
hole, which should still be closed. Either way the two failing tests force the decision.
(Reviewer did not touch source — author fixes, QA re-checks.)

---

## Hardening tests added (all green — pin behavior against future regression)

**`src/sanity/lib/stega.test.ts`** — the ancestor exclusion is a global
`sourcePath.some(seg => seg === "pageThemes")`; pinned its edges:
- deep (non-immediate) `pageThemes` ancestor → excluded;
- numeric array-index segments tolerated without throwing;
- leaf-name field (`brandColor`) excluded at arbitrary depth;
- **no over-match** on a substring sibling (`pageThemesArchive`) → not excluded;
- **documented over-reach**: a prose-named leaf (`title`) under a `pageThemes` ancestor IS
  excluded — pinned so any future narrowing is a conscious change;
- empty source path `[]` → `false`, no crash.

**`studio/schemaTypes/documents/entryValidators.test.ts`** —
- non-string `kind` (number/object/boolean/null) fails **open** via the allowlist `includes`,
  never requires a color or throws.

**`src/sanity/lib/queries.test.ts`** — the 4 passing executed-GROQ cases (absent/null → inherit,
themed → own color, no-settings → null) pin the *good* coalesce paths alongside the 2 failing ones.

---

## Attack surfaces probed and cleared (no defect)

- **stega ancestor match (#3):** correct for all 5 seeds and all path shapes; no under/over-match
  beyond the intentional, now-documented global reach. ✅
- **`requiredForThemedKind` boundaries (#2):** required for exactly note/essay/project (any
  stage), exempt for `now`, fail-open for unknown/future kinds and unpicked-kind drafts, treats
  `null`/`""` as missing. Allowlist (not `≠ now` denylist) is deliberate and well-tested. ✅
- **`pageThemes` required semantics (#4):** object + each of the 5 seeds carry `.required()`
  (schema-level; verified via the spy-Rule test that `.required()`/`.custom()` fire). Note:
  Sanity `.required()` rejects `""` for a string, so a *seed* cannot publish empty — the
  empty-string hazard is **only** on the entry-side `brandColor` (F1), not the seeds. ✅
- **TypeGen fidelity (#5):** `pnpm --filter studio typegen` + `git diff --exit-code
  sanity.types.ts` is **clean**. `themeSeed: string | null` and `pageThemes?` (optional,
  nullable inner) accurately model the query returns. ✅

---

## Gate results (honest exit codes; `pnpm test` not piped)

| Stage | Result |
|---|---|
| `pnpm lint` | ✅ pass |
| `pnpm lint:css` | ✅ pass (all rules layered) |
| `pnpm lint:keys` | ✅ pass |
| `pnpm lint:docs` | ✅ pass |
| `pnpm format:check` | ✅ pass |
| `pnpm typecheck` | ✅ pass |
| `pnpm test` | ❌ **2 failed / 63 passed** — the F1 + F2 fail-first defect tests (intended) |
| `pnpm --filter studio typegen` + `git diff --exit-code sanity.types.ts` | ✅ clean |
| `pnpm build` | ✅ pass |

The **only** red is the two fail-first defect tests. Every other stage — including my
hardening additions — is green. The gate goes green once the author closes F1/F2.

---

## Re-check
_(pending author fix)_
