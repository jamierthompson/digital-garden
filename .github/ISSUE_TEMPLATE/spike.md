---
name: Spike
about: A time-boxed investigation — the deliverable is a decision/answer, not shippable code
title: ""
labels: "type:spike"
---

<!-- A spike answers a question or reduces uncertainty before committing to an approach.
     It is NOT a feature. Add an area:* label if one fits. -->

## Question

<!-- The one thing this spike must answer. -->

## Time-box

<!-- A fixed budget, e.g. ½ day. Stop when it's spent, even if the answer is "we need another spike". -->

## Done when

- [ ] The question is answered, verified against the code / bundled docs (not memory).
- [ ] Anything architecturally significant is recorded as a new `[D#]` in `docs/decisions/`
      (reconcile with `docs/handbook/architecture.md`, don't duplicate).
- [ ] Findings written up (see Outcome).

## Out of scope

<!-- What this spike will NOT do. Production code shipped from a spike is out of scope — the
     spike produces knowledge; implementation lands as separate follow-up issues. -->

## Outcome

<!-- Fill on close: -->

- **Findings:** `docs/sessions/<date>-<slug>/spike-findings.md`
- **Decision:** `[D#]` (if any)
- **Follow-up issues:** #…
