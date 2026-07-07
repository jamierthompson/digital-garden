import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ThemeDeclaration } from "@/lib/theme";

import BrandThemeStyle from "./BrandThemeStyle";

describe("BrandThemeStyle", () => {
  it("renders the declarations as a single :root { } block", () => {
    const decls: ThemeDeclaration[] = [
      ["--accent", "light-dark(oklch(0.5 0.1 240), oklch(0.7 0.1 240))"],
      ["--bg", "light-dark(white, black)"],
    ];
    const html = renderToStaticMarkup(<BrandThemeStyle declarations={decls} />);
    expect(html).toContain(":root{");
    expect(html).toContain(
      "--accent:light-dark(oklch(0.5 0.1 240), oklch(0.7 0.1 240))",
    );
    expect(html).toContain("--bg:light-dark(white, black)");
  });

  it("opts into React <head> hoisting via href + precedence", () => {
    const html = renderToStaticMarkup(
      <BrandThemeStyle declarations={[["--x", "1"]]} />,
    );
    expect(html).toMatch(/href="page-theme"/);
    expect(html).toMatch(/precedence="high"/);
  });

  it("escapes < / > so no value can close the <style> element (injection defense)", () => {
    const html = renderToStaticMarkup(
      <BrandThemeStyle
        declarations={[["--x", "</style><script>alert(1)</script>"]]}
      />,
    );
    // The injected markup is escaped to CSS code points — no parseable tag survives.
    expect(html).not.toContain("<script");
    expect(html).toContain("\\3c "); // an escaped `<`
  });
});
