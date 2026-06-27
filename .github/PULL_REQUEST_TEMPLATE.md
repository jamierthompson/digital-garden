<!--
PR title must be Conventional-Commit-shaped (`feat:`, `fix(oklch):`, `docs:` …); the branch
prefix is the same token as the commit type.
This PR SQUASH-MERGES: the title becomes the squash-commit subject and the body below becomes
the squash-commit body on `main` — so this description IS the durable story. Tell it well.
Curate the branch first (rebase onto main, squash/reorder to a gate-green tip) — see
docs/handbook/git-and-pr-workflow.md §6.

Before merge, clear the Definition of Done — docs/handbook/definition-of-done.md. That doc is the
SINGLE source for the gate chain, the pre-PR adversarial QA pass, the browser check, and (for a
shared primitive) the §8 "don't reach up" litmus. Don't restate any of it here — just confirm it's done.
-->

## What & why

<!-- What changed, and the motivation/context. Write it like the future agent who'll read
     `git log` and find only this squash commit. One PR = one purpose. A short ordered
     "what landed" list earns its place here. -->

## How tested

<!-- The DoD gate (lint … build), plus anything manual: deploy preview, the chrome-devtools
     browser check on a rendered surface, the adversarial QA pass + its QA-log entry. -->

## Decisions touched

<!-- Any [D#] this obeys, implements, or supersedes (never edit an accepted decision — supersede
     it). "None" is a valid answer. -->

-
