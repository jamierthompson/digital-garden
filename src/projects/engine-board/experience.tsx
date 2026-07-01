import type { CSSProperties } from "react";

import styles from "./experience.module.css";

// The generic semantic role tokens the OKLCH engine bakes and `ProjectScope` re-binds per
// brand — the SAME names `@garden/oklch`'s `BrandTokenName` emits (`css.ts`). The board's
// whole job is to make that per-brand contract visible, so it enumerates the same names the
// engine bakes; a token added to the engine shows here once it's listed.
const SEMANTIC_TOKENS = [
  "bg",
  "surface",
  "surface-2",
  "border",
  "text",
  "text-muted",
  "accent",
  "accent-text",
  "on-accent",
  "focus-ring",
] as const;

// #66 status signal colors — accessible foregrounds at fixed canonical hues, harmonized with
// the brand only through the shared treatment. Rendering them is the status-bearing surface
// that proves #66 end-to-end.
const STATUS_TOKENS = ["success", "error", "warning", "info"] as const;

type TokenName =
  | (typeof SEMANTIC_TOKENS)[number]
  | (typeof STATUS_TOKENS)[number];

function Swatch({ token }: { token: TokenName }) {
  // The chip's fill is the live scoped token: `var(--<token>)` resolves to whatever brand
  // scope wraps the board, in the current color scheme (the engine's baked `light-dark()`
  // literal). An inline background is the one-source-of-truth way to key each chip off the
  // TOKENS list without duplicating it into 14 CSS rules.
  const chipStyle: CSSProperties = { background: `var(--${token})` };
  return (
    <li className={styles.swatch}>
      <span className={styles.chip} style={chipStyle} aria-hidden="true" />
      <code className={styles.label}>--{token}</code>
    </li>
  );
}

function TokenGroup({
  title,
  tokens,
}: {
  title: string;
  tokens: readonly TokenName[];
}) {
  return (
    <>
      <h3 className={styles.groupHeading}>{title}</h3>
      <ul className={styles.grid}>
        {tokens.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </ul>
    </>
  );
}

/**
 * The engine-output board — a static, CSS-var-consuming proof harness (issue #65). Every seed
 * brand points its `componentKey` here; wrapped in that brand's `ProjectScope`, the board
 * makes the engine's per-brand output VISIBLE — each emitted semantic and status token as a
 * swatch, in the ambient color scheme.
 *
 * A pure presentational Server Component: no JS engine run, no state, no `core/`. It reads
 * only the generic scoped tokens, so it prerenders flash-free into the static shell and
 * themes off whatever project scope composes it. Deliberately throwaway UI — its job is to
 * stress the plumbing end-to-end (route → Sanity → engine → scope → slot), not to be a
 * finished surface.
 */
export default function EngineBoardExperience() {
  return (
    <section className={styles.board} aria-labelledby="engine-board-heading">
      <h2 id="engine-board-heading" className={styles.heading}>
        Engine output
      </h2>
      <p className={styles.caption}>
        Every semantic and status token the OKLCH engine bakes for this brand,
        in the current color scheme.
      </p>
      <TokenGroup title="Semantic roles" tokens={SEMANTIC_TOKENS} />
      <TokenGroup title="Status signals" tokens={STATUS_TOKENS} />
    </section>
  );
}
