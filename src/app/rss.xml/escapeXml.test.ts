import { describe, expect, it } from "vitest";

import { escapeXml } from "./escapeXml";

/**
 * XML escaping is the RSS feed's correctness boundary: an unescaped `&` or `<` in
 * an authored title/blurb produces a malformed feed that readers reject. The async
 * RSC handler itself isn't unit-testable in jsdom (it reads the live client), so we
 * pin the pure escaper instead.
 */
describe("escapeXml", () => {
  it("escapes all five XML predefined entities", () => {
    expect(escapeXml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &apos;");
  });

  it("escapes ampersands first so they are not double-escaped", () => {
    // A naive order would turn `<` into `&lt;` and then re-escape that `&`.
    expect(escapeXml("a < b & c")).toBe("a &lt; b &amp; c");
  });

  it("escapes a markup-injection attempt into inert text", () => {
    expect(escapeXml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeXml("OKLCH engine")).toBe("OKLCH engine");
  });
});
