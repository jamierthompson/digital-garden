import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// See roster.test.ts: next/font/google is untransformed under Vitest, so mock the faces
// the roster imports (loaded transitively via EntryScope → resolveScope → FONT_FACES).
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "mock-inter" }),
  Newsreader: () => ({ variable: "mock-newsreader" }),
  Fraunces: () => ({ variable: "mock-fraunces" }),
  Space_Grotesk: () => ({ variable: "mock-space-grotesk" }),
  JetBrains_Mono: () => ({ variable: "mock-jetbrains-mono" }),
}));

import { FONT_FACES } from "@/fonts/roster";

import EntryScope from "./EntryScope";

// A seed that themes all three faces with distinct roster faces.
const ALL_THREE = {
  slug: "oklch-engine",
  headingFont: "space-grotesk",
  bodyFont: "newsreader",
  monoFont: "inter",
} as const;

// The face→leaf contract EntryScope stamps in TS (mirrors FACE_BINDINGS in the component).
// A resolved face stamps its leaf `--font-*` token (var(<face>) + generic) and mounts its
// `.variable` class; an unresolved face stamps neither. Which type roles read which leaf is the
// sheet's business (`semantic/type.css`), not this component's — see the sheet-side receipts in
// `src/styles/semantic/type.test.ts`.
const FACE_SPEC = {
  heading: { leaf: "--font-heading" },
  body: { leaf: "--font-body" },
  mono: { leaf: "--font-mono" },
} as const;

// Read an inline custom property straight off the element's style, so the assertion doesn't
// depend on jsdom computing cascaded custom properties.
const propOf = (el: Element | null, property: string): string =>
  (el as HTMLElement).style.getPropertyValue(property);

type FaceKey = keyof typeof FACE_SPEC;

// A resolved face stamped its leaf: var(<face>) tailed by the AUTHORED face's own category (#255) —
// NOT the leaf's role-default generic. The category the component reads is the roster's; roster.test
// independently pins each category to its verified value, so deriving the expectation here proves the
// tail FOLLOWS the resolved face's category without duplicating that per-face fact.
const expectFaceStamped = (
  wrapper: Element | null,
  face: FaceKey,
  fontKey: keyof typeof FONT_FACES,
): void => {
  const { leaf } = FACE_SPEC[face];
  expect(propOf(wrapper, leaf)).toBe(
    `var(${FONT_FACES[fontKey].cssVariable}), ${FONT_FACES[fontKey].category}`,
  );
};

// An absent/unresolvable face stamped nothing — its leaf is empty, so the sheet's slot-scope
// role bundles resolve against the inherited `:root` leaf (the editorial face).
const expectFaceAbsent = (wrapper: Element | null, face: FaceKey): void => {
  expect(propOf(wrapper, FACE_SPEC[face].leaf)).toBe("");
};

// EntryScope is a SYNC server component, so jsdom can render it (async RSCs cannot).
describe("EntryScope (three-face font slot)", () => {
  it("wraps children in the scoped [data-entry] and mounts each resolved face's class", () => {
    render(
      <EntryScope seed={ALL_THREE}>
        <p>module content</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("module content").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "oklch-engine");
    // Every resolved roster face's `.variable` className is on the wrapper.
    expect(wrapper).toHaveClass(FONT_FACES["space-grotesk"].variable);
    expect(wrapper).toHaveClass(FONT_FACES.newsreader.variable);
    expect(wrapper).toHaveClass(FONT_FACES.inter.variable);
  });

  it("stamps each resolved face's leaf --font-* token, and nothing else", () => {
    render(
      <EntryScope seed={ALL_THREE}>
        <p>themed</p>
      </EntryScope>,
    );
    const wrapper = screen
      .getByText("themed")
      .closest("[data-entry]") as HTMLElement;
    expectFaceStamped(wrapper, "heading", "space-grotesk");
    expectFaceStamped(wrapper, "body", "newsreader");
    expectFaceStamped(wrapper, "mono", "inter");
    // The wrapper carries no inline `font-family` — this component emits only the per-entry leaf
    // values; it never sets `font-family` on the wrapper itself.
    expect(propOf(wrapper, "font-family")).toBe("");
    // And it declares NO `--type-*` bundle: the role→face mapping lives solely in
    // `semantic/type.css` (declared at both `:root` and the slot scope). A component-side role
    // stamp would be a second home for that mapping — the duplication #262 removed.
    const typeProps = Array.from(wrapper.style).filter((property) =>
      property.startsWith("--type-"),
    );
    expect(typeProps).toEqual([]);
  });

  it("never appends the site palette or a self-reference to an override", () => {
    // The tail is the CSS generic keyword ONLY — a `var(--font-body)` self-reference would be a
    // CSS cycle (the whole declaration dropped) and appending the palette face would hardcode
    // what the slot must inherit. Guard both.
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "newsreader" }}>
        <p>body only</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("body only").closest("[data-entry]");
    const body = propOf(wrapper, "--font-body");
    expect(body).toBe(`var(${FONT_FACES.newsreader.cssVariable}), serif`);
    // No self-reference, and no site-palette faces leaked into the value.
    expect(body).not.toContain("var(--font-body)");
    expect(body).not.toContain("--font-source-serif-4");
    expect(body).not.toContain("--font-space-grotesk");
  });

  it("omits the leaf for an absent face so its roles inherit :root", () => {
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "newsreader" }}>
        <p>partial</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("partial").closest("[data-entry]");
    // Only body was seeded → body stamps its leaf; heading + mono stamp nothing (their leaves
    // stay unset → the sheet's bundles resolve against the inherited :root faces).
    expectFaceStamped(wrapper, "body", "newsreader");
    expectFaceAbsent(wrapper, "heading");
    expectFaceAbsent(wrapper, "mono");
    // Only the body face's class mounts.
    expect(wrapper).toHaveClass(FONT_FACES.newsreader.variable);
    expect(wrapper).not.toHaveClass(FONT_FACES["space-grotesk"].variable);
  });

  it("omits the leaf for a face whose key does not resolve", () => {
    render(
      <EntryScope
        seed={{ slug: "e", bodyFont: "not-a-font", monoFont: "inter" }}
      >
        <p>bad body</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("bad body").closest("[data-entry]");
    // Unknown body key → no body leaf; the resolvable mono sibling still stamps its own.
    expectFaceAbsent(wrapper, "body");
    expectFaceStamped(wrapper, "mono", "inter");
  });

  it("emits NO class attribute and NO overrides when no face resolves", () => {
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "nope" }}>
        <p>all inherit</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("all inherit").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "e");
    // No resolvable face → no class attribute (avoid an empty class) and no leaf stamped, so
    // every role inherits the site faces.
    expect(wrapper).not.toHaveAttribute("class");
    expectFaceAbsent(wrapper, "heading");
    expectFaceAbsent(wrapper, "body");
    expectFaceAbsent(wrapper, "mono");
  });

  it("keeps a safe unregistered slug as its own scope (never throws)", () => {
    // An entry without a component module still gets its OWN sanitized scope — not a shared
    // `fallback` — so two such entries can't cross-contaminate each other.
    expect(() =>
      render(
        <EntryScope seed={{ slug: "nope", bodyFont: "inter" }}>
          <p>still rendered</p>
        </EntryScope>,
      ),
    ).not.toThrow();
    expect(
      screen.getByText("still rendered").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "nope");
  });

  it("degrades to the constant fallback scope only for an empty/garbage slug", () => {
    render(
      <EntryScope seed={{ slug: "   ", bodyFont: "inter" }}>
        <p>fallback scope</p>
      </EntryScope>,
    );
    expect(
      screen.getByText("fallback scope").closest("[data-entry]"),
    ).toHaveAttribute("data-entry", "fallback");
  });

  it("never throws on garbage input and still renders children in the fallback scope", () => {
    expect(() =>
      render(
        // `seed` is typed `unknown`, so a hostile primitive is a valid prop here —
        // resolveScope collapses it to the fallback scope with no faces.
        <EntryScope seed={42}>
          <p>survived</p>
        </EntryScope>,
      ),
    ).not.toThrow();
    const wrapper = screen.getByText("survived").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "fallback");
    expect(wrapper).not.toHaveAttribute("class");
  });

  // ── QA additions (#226): the face-combination edges the suite above skips ──

  it.each([
    ["heading", "headingFont"],
    ["mono", "monoFont"],
  ] as const satisfies ReadonlyArray<readonly [FaceKey, string]>)(
    "a %s-ONLY seed stamps that face's leaf — the other two stamp nothing and inherit",
    (face, seedKey) => {
      // The suite pins body-only; a data-driven FACE_BINDINGS makes a transposition (right face,
      // wrong leaf/generic) possible per face, so pin the remaining two single-face seeds by the
      // stamped leaf AND by the absence of both siblings.
      render(
        <EntryScope seed={{ slug: "e", [seedKey]: "fraunces" }}>
          <p>single face</p>
        </EntryScope>,
      );
      const wrapper = screen.getByText("single face").closest("[data-entry]");
      expectFaceStamped(wrapper, face, "fraunces");
      for (const other of Object.keys(FACE_SPEC) as FaceKey[]) {
        if (other !== face) expectFaceAbsent(wrapper, other);
      }
      expect(wrapper).toHaveClass(FONT_FACES.fraunces.variable);
    },
  );

  it("applies ONE face to all three leaves when the seed repeats it (each face gets its own override)", () => {
    // An editor can pick the same roster face for heading, body, AND mono. Each face still
    // emits its own leaf (same face var, face-correct generic tail); repeating the
    // face's `.variable` class is harmless (classList membership, not count, is what CSS sees).
    render(
      <EntryScope
        seed={{
          slug: "mono-brand",
          headingFont: "inter",
          bodyFont: "inter",
          monoFont: "inter",
        }}
      >
        <p>one face everywhere</p>
      </EntryScope>,
    );
    const wrapper = screen
      .getByText("one face everywhere")
      .closest("[data-entry]");
    expectFaceStamped(wrapper, "heading", "inter");
    expectFaceStamped(wrapper, "body", "inter");
    expectFaceStamped(wrapper, "mono", "inter");
    expect(wrapper).toHaveClass(FONT_FACES.inter.variable);
  });

  // `--font-ui` (Instrument Sans) is the SITE's UI voice — a binding an entry never authors.
  // An entry themes its slot through exactly three leaves (heading/body/mono); inside the slot
  // the label/meta/kicker roles re-bind to THAT palette via semantic/type.css's slot-scope
  // rule, not by touching `--font-ui`. Pin the boundary: even a seed that fills all three
  // themeable roles must leave `--font-ui` untouched — the two palettes stay separate systems.
  it("never rebinds --font-ui — the site's UI voice is not an entry-themeable leaf", () => {
    render(
      <EntryScope
        seed={{
          slug: "all-three",
          headingFont: "space-grotesk",
          bodyFont: "newsreader",
          monoFont: "jetbrains-mono",
        }}
      >
        <p>fully themed</p>
      </EntryScope>,
    );
    const wrapper = screen
      .getByText("fully themed")
      .closest("[data-entry]") as HTMLElement;
    // All three themeable leaves ARE stamped…
    expectFaceStamped(wrapper, "heading", "space-grotesk");
    expectFaceStamped(wrapper, "body", "newsreader");
    expectFaceStamped(wrapper, "mono", "jetbrains-mono");
    // …but --font-ui is never emitted; inside the slot the meta/label/kicker roles reach the
    // entry palette through the slot-scope re-bind in semantic/type.css instead.
    expect(propOf(wrapper, "--font-ui")).toBe("");
    // Nor does any authored fontKey slip a `--font-ui` override in through another path.
    const uiProps = Array.from(wrapper.style).filter(
      (property) => property === "--font-ui",
    );
    expect(uiProps).toEqual([]);
  });

  it("collapses an ARRAY seed to the fallback scope (arrays pass the typeof-object guard)", () => {
    expect(() =>
      render(
        <EntryScope seed={["inter", "newsreader"]}>
          <p>array seed</p>
        </EntryScope>,
      ),
    ).not.toThrow();
    const wrapper = screen.getByText("array seed").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "fallback");
    expect(wrapper).not.toHaveAttribute("class");
  });

  it("gives two distinct entries their OWN inline fonts (per-element, no cross-slot bleed)", () => {
    // The inline style is per-element, so two co-mounted slots can never share (or overwrite)
    // one another's fonts — the failure a shared hoisted <style> once risked.
    render(
      <>
        <EntryScope seed={{ slug: "alpha", bodyFont: "inter" }}>
          <p>a</p>
        </EntryScope>
        <EntryScope seed={{ slug: "beta", bodyFont: "fraunces" }}>
          <p>b</p>
        </EntryScope>
      </>,
    );
    const a = screen.getByText("a").closest("[data-entry]");
    const b = screen.getByText("b").closest("[data-entry]");
    expect(a).toHaveAttribute("data-entry", "alpha");
    expect(b).toHaveAttribute("data-entry", "beta");
    // inter is a sans-serif and fraunces a serif, so each body leaf tails its OWN face's category —
    // NOT the body role's site-default `serif`.
    expect(propOf(a, "--font-body")).toBe(
      `var(${FONT_FACES.inter.cssVariable}), sans-serif`,
    );
    expect(propOf(b, "--font-body")).toBe(
      `var(${FONT_FACES.fraunces.cssVariable}), serif`,
    );
  });

  // ── #255: the terminal generic follows the AUTHORED face's category, not the role default ──

  it.each([
    // face, role seed key, roster key, role-default generic (the OLD, wrong tail), authored category
    // — the FULL role × foreign-category matrix (each role has two foreign categories).
    ["heading", "headingFont", "fraunces", "sans-serif", "serif"],
    ["heading", "headingFont", "jetbrains-mono", "sans-serif", "monospace"],
    ["body", "bodyFont", "inter", "serif", "sans-serif"],
    ["body", "bodyFont", "jetbrains-mono", "serif", "monospace"],
    ["mono", "monoFont", "inter", "monospace", "sans-serif"],
    ["mono", "monoFont", "fraunces", "monospace", "serif"],
  ] as const satisfies ReadonlyArray<
    readonly [FaceKey, string, keyof typeof FONT_FACES, string, string]
  >)(
    "a cross-category %s face tails its OWN generic, never the role default",
    (face, seedKey, fontKey, roleDefault, authoredCategory) => {
      render(
        <EntryScope seed={{ slug: "x", [seedKey]: fontKey }}>
          <p>cross</p>
        </EntryScope>,
      );
      const leaf = FACE_SPEC[face].leaf;
      const value = propOf(
        screen.getByText("cross").closest("[data-entry]"),
        leaf,
      );
      expect(value).toBe(
        `var(${FONT_FACES[fontKey].cssVariable}), ${authoredCategory}`,
      );
      // Not the pre-#255 role-keyed tail. (Full-string, not substring: `sans-serif` contains
      // `serif`, so a bare `toContain` would misfire on the body/heading rows.)
      expect(value).not.toBe(
        `var(${FONT_FACES[fontKey].cssVariable}), ${roleDefault}`,
      );
    },
  );

  it.each([
    // face, role seed key, roster key whose category EQUALS the role default, shared generic —
    // for these combos the authored category and the old role default coincide, so the emitted
    // string must be byte-identical to the pre-#255 output (the fix changes nothing here).
    ["heading", "headingFont", "space-grotesk", "sans-serif"],
    ["body", "bodyFont", "newsreader", "serif"],
    ["mono", "monoFont", "jetbrains-mono", "monospace"],
  ] as const satisfies ReadonlyArray<
    readonly [FaceKey, string, keyof typeof FONT_FACES, string]
  >)(
    "leaves a SAME-category %s face unchanged vs the role default",
    (face, seedKey, fontKey, generic) => {
      render(
        <EntryScope seed={{ slug: "x", [seedKey]: fontKey }}>
          <p>same</p>
        </EntryScope>,
      );
      expect(
        propOf(
          screen.getByText("same").closest("[data-entry]"),
          FACE_SPEC[face].leaf,
        ),
      ).toBe(`var(${FONT_FACES[fontKey].cssVariable}), ${generic}`);
    },
  );
});
