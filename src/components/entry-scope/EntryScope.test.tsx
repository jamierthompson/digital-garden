import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

// A seed that themes all three roles with distinct roster faces.
const ALL_THREE = {
  slug: "oklch-engine",
  headingFont: "space-grotesk",
  bodyFont: "newsreader",
  monoFont: "inter",
} as const;

// The role→face contract EntryScope stamps in TS (mirrors `:root` in semantic/type.css and
// FACE_BINDINGS in the component). Each face, when resolved, stamps TWO channels: its leaf
// `--font-*` token (var(<face>) + generic) AND every `--type-<role>-family` bundle mapped to it,
// valued `var(<leaf>)`. An unresolved face stamps NEITHER channel, so its roles inherit `:root`.
const FACE_SPEC = {
  heading: {
    leaf: "--font-heading",
    generic: "sans-serif",
    roles: ["display", "title", "heading", "subheading", "label"],
  },
  body: {
    leaf: "--font-body",
    generic: "serif",
    roles: ["lead", "body", "caption", "quote"],
  },
  mono: { leaf: "--font-mono", generic: "monospace", roles: ["meta"] },
} as const;

// Read an inline custom property straight off the element's style, so the assertion doesn't
// depend on jsdom computing cascaded custom properties.
const propOf = (el: Element | null, property: string): string =>
  (el as HTMLElement).style.getPropertyValue(property);

type FaceKey = keyof typeof FACE_SPEC;

// A resolved face stamped BOTH channels: its leaf (var(<face>) + generic) and every
// `--type-<role>-family` bundle mapped to it (var(<leaf>) — the leaf co-declared on this element).
const expectFaceStamped = (
  wrapper: Element | null,
  face: FaceKey,
  fontKey: keyof typeof FONT_FACES,
): void => {
  const { leaf, generic, roles } = FACE_SPEC[face];
  expect(propOf(wrapper, leaf)).toBe(
    `var(${FONT_FACES[fontKey].cssVariable}), ${generic}`,
  );
  for (const role of roles) {
    expect(propOf(wrapper, `--type-${role}-family`)).toBe(`var(${leaf})`);
  }
};

// An absent/unresolvable face stamped NEITHER channel — its leaf AND every mapped role bundle are
// empty, so those roles inherit `:root`'s editorial face.
const expectFaceAbsent = (wrapper: Element | null, face: FaceKey): void => {
  const { leaf, roles } = FACE_SPEC[face];
  expect(propOf(wrapper, leaf)).toBe("");
  for (const role of roles) {
    expect(propOf(wrapper, `--type-${role}-family`)).toBe("");
  }
};

// EntryScope is a SYNC server component, so jsdom can render it (async RSCs cannot).
describe("EntryScope (three-role font slot)", () => {
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

  it("stamps both channels per resolved face: the leaf --font-* AND every --type-<role>-family bundle", () => {
    render(
      <EntryScope seed={ALL_THREE}>
        <p>themed</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("themed").closest("[data-entry]");
    // Each face stamps its leaf (var(<face>) + generic) and every role bundle mapped to it.
    expectFaceStamped(wrapper, "heading", "space-grotesk");
    expectFaceStamped(wrapper, "body", "newsreader");
    expectFaceStamped(wrapper, "mono", "inter");
    // The wrapper carries no inline `font-family` — this component emits only the per-entry token
    // values (the leaves + role bundles); it never sets `font-family` on the wrapper itself.
    expect(propOf(wrapper, "font-family")).toBe("");
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

  it("omits BOTH channels for an absent face so its roles inherit :root", () => {
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "newsreader" }}>
        <p>partial</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("partial").closest("[data-entry]");
    // Only body was seeded → body stamps both channels; heading + mono stamp NEITHER (leaf and
    // every role bundle mapped to them stay unset → inherit :root).
    expectFaceStamped(wrapper, "body", "newsreader");
    expectFaceAbsent(wrapper, "heading");
    expectFaceAbsent(wrapper, "mono");
    // Only the body face's class mounts.
    expect(wrapper).toHaveClass(FONT_FACES.newsreader.variable);
    expect(wrapper).not.toHaveClass(FONT_FACES["space-grotesk"].variable);
  });

  it("omits BOTH channels for a face whose key does not resolve", () => {
    render(
      <EntryScope
        seed={{ slug: "e", bodyFont: "not-a-font", monoFont: "inter" }}
      >
        <p>bad body</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("bad body").closest("[data-entry]");
    // Unknown body key → no body leaf and no body role bundles; the resolvable mono sibling still
    // stamps both channels.
    expectFaceAbsent(wrapper, "body");
    expectFaceStamped(wrapper, "mono", "inter");
  });

  it("emits NO class attribute and NO overrides when no role resolves", () => {
    render(
      <EntryScope seed={{ slug: "e", bodyFont: "nope" }}>
        <p>all inherit</p>
      </EntryScope>,
    );
    const wrapper = screen.getByText("all inherit").closest("[data-entry]");
    expect(wrapper).toHaveAttribute("data-entry", "e");
    // No resolvable face → no class attribute (avoid an empty class) and every role inherits —
    // neither the leaves nor any --type-<role>-family bundle is stamped.
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

  // ── QA additions (#226): the role-combination edges the suite above skips ──

  it.each([
    ["heading", "headingFont"],
    ["mono", "monoFont"],
  ] as const satisfies ReadonlyArray<readonly [FaceKey, string]>)(
    "a %s-ONLY seed stamps both channels for that face — the other two faces stamp neither and inherit",
    (face, seedKey) => {
      // The suite pins body-only; a data-driven FACE_BINDINGS makes a transposition (right face,
      // wrong leaf/generic, or a role bundle mapped to the wrong face) possible per role, so pin
      // the remaining two single-role seeds by BOTH channels AND by the absence of both siblings.
      render(
        <EntryScope seed={{ slug: "e", [seedKey]: "fraunces" }}>
          <p>single role</p>
        </EntryScope>,
      );
      const wrapper = screen.getByText("single role").closest("[data-entry]");
      expectFaceStamped(wrapper, face, "fraunces");
      for (const other of Object.keys(FACE_SPEC) as FaceKey[]) {
        if (other !== face) expectFaceAbsent(wrapper, other);
      }
      expect(wrapper).toHaveClass(FONT_FACES.fraunces.variable);
    },
  );

  it("applies ONE face to all three roles when the seed repeats it (each role gets its own override)", () => {
    // An editor can pick the same roster face for heading, body, AND mono. Each role still
    // emits its own override (same face var, role-correct generic tail); repeating the
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
    // Every face resolves to the same roster face, so each stamps its own leaf (role-correct
    // generic) and its own role bundles — all eight bundles present, each pointing at its leaf.
    expectFaceStamped(wrapper, "heading", "inter");
    expectFaceStamped(wrapper, "body", "inter");
    expectFaceStamped(wrapper, "mono", "inter");
    expect(wrapper).toHaveClass(FONT_FACES.inter.variable);
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
    expect(propOf(a, "--font-body")).toBe(
      `var(${FONT_FACES.inter.cssVariable}), serif`,
    );
    expect(propOf(b, "--font-body")).toBe(
      `var(${FONT_FACES.fraunces.cssVariable}), serif`,
    );
  });
});

/**
 * QA (#226 rework): FACE_BINDINGS ↔ `semantic/type.css` sync. EntryScope's docblock claims its
 * role→face map "mirrors `:root` in `type.css`", but the two live in different files with no
 * compiler holding them together — and the suite above asserts against FACE_SPEC, a third
 * hand-copied statement of the same map. Parse the sheet's actual
 * `--type-<role>-family: var(--font-<face>)` bindings and assert, on a fully-themed render, that
 * (a) every sheet role is stamped pointing at the SAME face the sheet maps it to, and (b) the
 * slot stamps NO family bundle the sheet doesn't declare. Adding a role to type.css without
 * extending FACE_BINDINGS (or re-mapping a role to a different face in only one place) fails
 * here instead of silently splitting a themed slot between entry and site faces.
 */
describe("EntryScope role→face map mirrors semantic/type.css (QA #226 rework)", () => {
  const sheet = readFileSync(
    resolve(process.cwd(), "src/styles/semantic/type.css"),
    "utf8",
  );
  const sheetBindings = [
    ...sheet.matchAll(
      /--type-([a-z0-9]+)-family:\s*var\(--font-(heading|body|mono)\)/g,
    ),
  ].map(([, role, face]) => ({ role, face }));

  it("parses the full role set out of the sheet (false-green guard)", () => {
    expect(sheetBindings.map(({ role }) => role).sort()).toEqual([
      "body",
      "caption",
      "display",
      "heading",
      "label",
      "lead",
      "meta",
      "quote",
      "subheading",
      "title",
    ]);
  });

  it("stamps every sheet role onto the face the sheet maps it to — and no bundle the sheet lacks", () => {
    render(
      <EntryScope seed={ALL_THREE}>
        <p>sheet sync</p>
      </EntryScope>,
    );
    const wrapper = screen
      .getByText("sheet sync")
      .closest("[data-entry]") as HTMLElement;
    for (const { role, face } of sheetBindings) {
      expect(
        propOf(wrapper, `--type-${role}-family`),
        `--type-${role}-family should re-bind to the slot's --font-${face}`,
      ).toBe(`var(--font-${face})`);
    }
    // Reverse direction: the slot declares no `--type-*-family` the sheet doesn't — a stamped
    // bundle no primitive reads would be dead weight that hides a rename drift.
    const stamped = Array.from(wrapper.style)
      .filter((property) => /^--type-[a-z0-9]+-family$/.test(property))
      .sort();
    expect(stamped).toEqual(
      sheetBindings.map(({ role }) => `--type-${role}-family`).sort(),
    );
  });
});
