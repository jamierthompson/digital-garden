import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Focus-ring UNIFICATION guard (#200): the ring geometry lives in `foundation/focus.css` as
 * `--ring-{width,offset,style}` and the ring COLOR is the engine's `--ring` semantic token,
 * consumed directly by the single `:focus-visible` rule in `reset.css`. The retired
 * `--focus-ring-*` vocabulary (both the dropped `--focus-ring-color` alias and the old
 * `--focus-ring-{width,offset,style}` geometry) must be GONE from both halves — a half-revert
 * on either side is a split-brain that silently paints no ring. The color side is pinned in
 * `semantic/color.test.ts`; this pins the geometry side + the consumer wiring.
 */
const stripComments = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, "");

const FOCUS = stripComments(
  readFileSync(
    resolve(process.cwd(), "src/styles/foundation/focus.css"),
    "utf8",
  ),
);
const RESET = stripComments(
  readFileSync(resolve(process.cwd(), "src/styles/reset.css"), "utf8"),
);

describe("focus-ring geometry unification", () => {
  it("declares the --ring-* geometry tokens in foundation/focus.css", () => {
    expect(FOCUS).toMatch(/--ring-width\s*:/);
    expect(FOCUS).toMatch(/--ring-offset\s*:/);
    expect(FOCUS).toMatch(/--ring-style\s*:/);
  });

  it("carries no retired --focus-ring-* geometry token", () => {
    expect(FOCUS).not.toMatch(/--focus-ring-/);
  });

  it(":focus-visible in reset.css consumes the --ring-* geometry and the --ring color", () => {
    const rule = RESET.match(/:focus-visible\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const body = rule![1];
    expect(body).toMatch(/var\(--ring-width\)/);
    expect(body).toMatch(/var\(--ring-style\)/);
    expect(body).toMatch(/var\(--ring-offset\)/);
    // the color slot reads the engine token directly — no --focus-ring-color alias hop
    expect(body).toMatch(/var\(--ring[,)]/);
  });

  it("reset.css references no retired --focus-ring-* variable", () => {
    expect(RESET).not.toMatch(/--focus-ring-/);
  });
});
