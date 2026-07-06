# Mode: Research (facts only)

> Read [`../SKILL.md`](../SKILL.md) (Preflight + universal mechanics) first.
> This mode answers **factual questions**: version-exact framework/library behavior,
> external standards, unfamiliar APIs. Its output is a **dense, cited digest of facts**.
> It does not produce designs — design decisions happen in conversation with the owner,
> whose intent is the primary input; agents support a design by verifying it (fact
> digests, clickable browser spikes, adversarial review of the chosen direction).

## The shape: parallel researchers → cited digests → reconciled synthesis

**1. Split by source domain, not by opinion.** One researcher per domain the question
touches — e.g. the bundled Next docs (`node_modules/next/dist/docs/`), the installed
package's types/source, the spec or standard, the repo's own receipts (tests, postmortem
comments). Subagents are usually the right tool (fetch-and-report, no cross-talk needed);
use a team only when researchers must challenge each other's readings of ambiguous
sources.

**2. Every claim pinned to a primary source.** The digest cites the file/URL that
_actually contains_ the fact — bundled-doc path, spec section, `path:line`. A claim
without a source is a guess and is labeled as one.

**3. Reconcile conflicts by re-checking the source (lead's job).** Where two digests
disagree, the resolution is reading the source again, not averaging. It is healthy for
some claims to die on verification.

**4. Record the outcome where it lives.** Facts that change a doc get the doc edited in
place, in the same PR as the code they affect; the trail (digests, dead claims) goes in
the PR body. There is no decision log — git history is the audit trail.

## Team setup (when a team at all — see Preflight)

- 2–4 researchers + you as lead. Name them by source domain.
- Each brief: the question, the exact sources by path/URL, boundaries, "return a dense
  cited digest", model tier (Opus default), and cite-don't-remember restated.
- Keep each digest in its own scratch file; fold into the synthesis at the end.
