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

  /**
   * The feed's second correctness boundary (#288): characters that either break
   * XML 1.0 outright (a single one makes a conformant parser reject the whole feed —
   * https://www.w3.org/TR/xml/#charsets) or are legal-but-restricted controls that
   * would dirty the feed with mojibake. None can be typed in the Studio, but all are
   * reachable via a raw Content Lake write.
   */
  describe("strips characters that break or dirty the feed (#288)", () => {
    it("drops C0 controls, DEL, the C1 controls, and the U+FFFE/U+FFFF noncharacters", () => {
      const value = "a\x00b\x08c\x0Bd\x0Ce\x1Ff\x7Fg\x80h\x9Fi\uFFFEj\uFFFFk";
      expect(escapeXml(value)).toBe("abcdefghijk");
    });

    it("keeps tab, newline, and carriage return — the only permitted C0 controls", () => {
      expect(escapeXml("a\tb\nc\rd")).toBe("a\tb\nc\rd");
    });

    it("preserves a legal astral character (a valid surrogate pair) such as an emoji", () => {
      expect(escapeXml("seed \u{1F331} done")).toBe("seed \u{1F331} done");
    });

    it("drops a lone surrogate while keeping the emoji beside it intact", () => {
      // A high surrogate not followed by a low one (and vice versa) is not a valid
      // code point and is illegal in XML; the adjacent complete pair must survive.
      expect(escapeXml("\u{1F331}\uD800 end")).toBe("\u{1F331} end");
      expect(escapeXml("start \uDC00\u{1F331}")).toBe("start \u{1F331}");
    });

    it("still escapes entities after stripping — the two passes compose", () => {
      expect(escapeXml("A\x00 & B")).toBe("A &amp; B");
    });
  });

  /**
   * Adversarial QA: boundary cases for the strip pass, pinned against the XML 1.0
   * Char production (https://www.w3.org/TR/xml/#charsets):
   * Char ::= #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
   */
  describe("adversarial QA", () => {
    it("drops a lone high surrogate at end-of-string and a lone low at start-of-string", () => {
      // The look-around alternatives must behave at both string boundaries: a high
      // surrogate with nothing after it, and a low with nothing before it.
      expect(escapeXml("abc\uD800")).toBe("abc");
      expect(escapeXml("\uDC00abc")).toBe("abc");
    });

    it("drops every surrogate in an adjacent lone-surrogate run", () => {
      // high+high: the first fails the low-lookahead, the second sits at end-of-string.
      expect(escapeXml("a\uD800\uD800b")).toBe("ab");
      // low+low: the first has no high before it, the second is preceded by a LOW.
      expect(escapeXml("a\uDC00\uDC00b")).toBe("ab");
      // high preceded by high, followed by a low: only the first high is lone —
      // the remaining two code units form a valid pair that must survive.
      expect(escapeXml("\uD800\u{10000}")).toBe("\u{10000}");
      // valid pair followed by a stray low: the pair survives, the stray goes.
      expect(escapeXml("\u{1F331}\uDF31")).toBe("\u{1F331}");
    });

    it("never welds a fake pair when the char between a lone high and a lone low is stripped", () => {
      // All three code units are individually illegal (lone high, NUL, lone low).
      // Stripping the NUL must not leave the high and low adjacent as if they were
      // a legal pair — the look-arounds evaluate against the original string, so
      // all three are dropped.
      expect(escapeXml("\uD83C\x00\uDF31")).toBe("");
    });

    it("strips the restricted controls but keeps the legal non-control noncharacters", () => {
      // DEL and the C1 controls (U+007F–U+009F) are legal under the Char production
      // but on XML 1.1's restricted-character list (https://www.w3.org/TR/xml11/#charsets)
      // and stripped as hardening. The genuinely-legal
      // noncharacters that are NOT controls — U+FDD0-FDEF, the plane-end
      // noncharacters (U+1FFFE …), and U+FFFD — a conformant parser accepts, so they
      // must survive.
      expect(escapeXml("a\x7Fb\x85c\x9Fd")).toBe("abcd");
      expect(escapeXml("a\uFDD0b")).toBe("a\uFDD0b");
      expect(escapeXml("a\u{1FFFE}b")).toBe("a\u{1FFFE}b");
      expect(escapeXml("a\uFFFDb")).toBe("a\uFFFDb");
    });

    it("returns an empty string when every character is unsafe", () => {
      expect(escapeXml("\x00\x01\uD800\uFFFE")).toBe("");
    });

    it("cannot conjure an unescaped entity by stripping — juxtaposed fragments still escape", () => {
      // Stripping the NUL joins `&` and `lt;`; the later escape pass must still
      // neutralize that ampersand so the parser hands back the literal text `&lt;`.
      expect(escapeXml("&\x00lt;")).toBe("&amp;lt;");
    });
  });
});
