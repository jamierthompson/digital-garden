# Studio — Sanity content workspace

The Sanity Studio for the digital garden: the content model (schema), Studio config, and the
Presentation/Visual Editing wiring. A separate pnpm workspace package (`studio/`) with its own
deps and concerns, deployed independently of the Next.js app.

## Layout

- `sanity.config.ts` — workspace config: plugins, Presentation tool, document structure.
- `sanity.cli.ts` — project id / dataset / `studioHost` for the CLI (`dev`, `deploy`, `typegen`).
- `schemaTypes/` — the content model: `documents/` (project, note, siteSettings), `objects/`
  (figure, liveEmbed, portableText), and `shared/` validators.

## Commands

Run from the repo root via the workspace filter:

```bash
pnpm --filter studio dev       # local Studio at http://localhost:3333
pnpm --filter studio deploy    # deploy the hosted Studio (also pushes the schema)
pnpm --filter studio typegen   # regenerate types — writes ./sanity.types.ts at the REPO ROOT
```

After any schema change, run `typegen` and commit the regenerated **root** `sanity.types.ts` — the
gate checks it for drift `[D23]`.

Project-wide conventions live in the root [`AGENTS.md`](../AGENTS.md) and
[`docs/handbook/`](../docs/handbook/); Sanity-specific decisions are in
[`docs/decisions/`](../docs/decisions/) (cite as `[D#]`).
