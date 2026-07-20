import postcss from "postcss";
import { describe, expect, it } from "vitest";

import {
  readModuleCss,
  referencedCustomProperties,
  ruleDeclarations,
} from "../../../tests/cssModule";

/**
 * The slice's headline claim, made executable (QA, independent of the slice).
 *
 * "Structural headings are neutral ink; the entry h1 keeps `accent-text` as the ONE display
 * exception." That rule was applied by DELETING `color: var(--accent-text)` declarations from
 * two CSS Modules — and a deletion leaves nothing behind to test, so the whole claim shipped
 * unguarded. Re-adding the accent to a body `h2` would be invisible to every existing test.
 *
 * These pin the rule at the CSS SOURCE (jsdom loads no stylesheets and computes no custom
 * properties, so source is the only place a designed value can be asserted), via the repo's
 * postcss helpers — a commented-out declaration is NOT a live one, which a hand-rolled regex
 * could not tell apart.
 */

const ARTICLE_CSS = readModuleCss("src/app/[slug]/page.module.css");
const RELATED_CSS = readModuleCss(
  "src/components/entry/RelatedEntries.module.css",
);
const CARD_CSS = readModuleCss("src/components/entry/EntryCard.module.css");

describe("structural headings are neutral ink", () => {
  it("the entry body's h2/h3 rule declares no color at all", () => {
    const decls = ruleDeclarations(ARTICLE_CSS, ".article > :is(h2, h3)");
    // Assert the rule still EXISTS (a renamed selector would also yield an empty map) …
    expect(decls.size).toBeGreaterThan(0);
    // … and that ink is not among its declarations: the headings inherit the editorial ink.
    expect(decls.has("color")).toBe(false);
  });

  it("the entry article module references no accent ink anywhere", () => {
    // Broader than the single rule above: catches the accent creeping back in on a sibling
    // selector (`.article h4`, a `:first-of-type`, a media query) rather than the pinned one.
    const vars = referencedCustomProperties(ARTICLE_CSS);
    expect([...vars].filter((v) => v.includes("accent"))).toEqual([]);
  });

  it("RelatedEntries declares no ink in CSS — its label ink travels via the color prop", () => {
    // The `.heading` rule was deleted in favour of `color="muted-foreground"` on the primitive.
    // Ink stated in BOTH places is the drift this guards: the CSS module would win at equal
    // layer and silently override the prop the component reads.
    expect(ruleDeclarations(RELATED_CSS, ".heading").size).toBe(0);
    expect(
      [...referencedCustomProperties(RELATED_CSS)].filter((v) =>
        v.includes("accent"),
      ),
    ).toEqual([]);
    // The module's remaining ink (`.item { color: var(--foreground) }`) is the list's own
    // body ink and is deliberately in scope for CSS; only the LABEL moved to the prop.
    expect(ruleDeclarations(RELATED_CSS, ".item").get("color")).toBe(
      "var(--foreground)",
    );
  });
});

describe("EntryCard is a neutral surface", () => {
  it("declares no ink ROLE in CSS — summary/meta ink is the type primitives' color prop", () => {
    // The card comment states "Ink is not declared here". Verified precisely: the module's one
    // `color` declaration is `.link { color: inherit }` — a UA link-blue reset, not a role. Any
    // `color: var(--<role>)` would be the module taking ink back from the primitives, which is
    // the drift this guards (CSS and prop both stating ink → the module wins at equal layer).
    const inks: string[] = [];
    postcss.parse(CARD_CSS).walkDecls("color", (decl) => inks.push(decl.value));
    expect(inks).toEqual(["inherit"]);
  });

  it("reads no accent token — the plate is --surface with a --border hairline", () => {
    const vars = referencedCustomProperties(CARD_CSS);
    expect([...vars].filter((v) => v.includes("accent"))).toEqual([]);
    expect(vars.has("--surface")).toBe(true);
    expect(vars.has("--border")).toBe(true);
  });

  it("draws the focus ring from the ring role, inset so overflow:hidden can't clip it", () => {
    const focus = ruleDeclarations(CARD_CSS, ".link:focus-visible");
    expect(focus.get("outline")).toContain("var(--ring)");
    // `.card` sets `overflow: hidden`; a non-negative offset would clip the indicator away
    // entirely, failing WCAG 2.2 SC 2.4.11 Focus Not Obscured.
    // https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum
    const offset = focus.get("outline-offset") ?? "";
    expect(parseFloat(offset)).toBeLessThan(0);
  });

  it("keeps the head mark a STRUCTURE token, never a text-tier ink", () => {
    // `--card-mark` paints a non-text graphic (WCAG 2.2 SC 1.4.11, solved at the `ui` tier).
    // Binding it to a `*-text` role would be the wrong tier — and `lint:icon` cannot see it,
    // because `.card` does not tokenize to a graphic word and the property is `background`.
    const card = ruleDeclarations(CARD_CSS, ".card");
    const mark = card.get("--card-mark") ?? "";
    expect(mark).toBe("var(--border)");
    expect(mark).not.toMatch(/-text\s*[,)]/);
  });
});

describe("the entry h1 is the one display exception", () => {
  it("keeps accent-text on the entry title, via the prop and not CSS", () => {
    // The exception is real and deliberate — pin it so a future "neutralise everything" sweep
    // has to change a test, not just a line.
    const page = readModuleCss("src/app/[slug]/page.tsx");
    expect(page).toContain('<Heading level={1} color="accent-text">');
  });
});
