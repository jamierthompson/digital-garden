# Contributing

This is a **personal portfolio and digital garden** — built in the open as a working example of an
**AI-agent-driven development workflow**, not an open-source project seeking outside contributions.
Development is done by the owner ([@jamierthompson](https://github.com/jamierthompson)) working with
AI coding agents, and the code is [source-available, not licensed for reuse](./LICENSE).

You're very welcome to **read the code and open an issue** if you spot a bug or have a suggestion.
Outside pull requests aren't accepted — the repo runs a specific solo + agent workflow (below), so
unsolicited PRs will be closed politely.

## Found a bug or have an idea?

Open a [GitHub issue](https://github.com/jamierthompson/digital-garden/issues). The
[issue templates](./.github/ISSUE_TEMPLATE/) cover bug reports, tasks, and spikes; pick whichever fits.

## How development works here — the workflow on display

This section is the point of the file: it documents the **owner's own process**, the same one every
commit in this repo follows. The full operating manual is the **[handbook](./docs/)** —
start at [`orientation.md`](./docs/orientation.md); the agent-facing entry point is
[`AGENTS.md`](./AGENTS.md). In short:

- **Never commit to `main`** — branch first (`feat/…`, `fix/…`, `chore/…`); a merge to `main`
  is a production deploy on Vercel.
- **The gate must be green** before a PR — the one command in
  [`docs/definition-of-done.md`](./docs/definition-of-done.md), which CI
  re-runs on every PR.
- **Every slice clears independent, adversarial QA** before it merges — the dev↔QA loop in
  [`docs/working-with-agents.md`](./docs/working-with-agents.md).
- **PRs squash-merge**, so the PR description is the durable history — see
  [`docs/git-and-pr-workflow.md`](./docs/git-and-pr-workflow.md).

The system model lives in [`docs/architecture.md`](./docs/architecture.md) (refer
to its sections by name). There is **no separate decision log** — the docs are the current source of
truth, edited in place, and git history is the audit trail.
