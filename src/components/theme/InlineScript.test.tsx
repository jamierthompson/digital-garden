import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import InlineScript from "./InlineScript";

describe("InlineScript", () => {
  it("renders a <script> carrying the given html verbatim", () => {
    const { container } = render(<InlineScript html="var x=1;" />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script?.innerHTML).toBe("var x=1;");
  });

  it("uses type=text/plain in the browser so it does NOT re-execute on soft navigation", () => {
    // jsdom defines `window`, so the component takes its client branch — the parse-time
    // execution happened on the server; on the client the re-applier owns re-theming.
    const { container } = render(<InlineScript html="var x=1;" />);
    expect(container.querySelector("script")).toHaveAttribute(
      "type",
      "text/plain",
    );
  });

  // --- Adversarial QA (#172): the server half of the type flip, and the no-escaping
  // contract the caller carries. ---

  describe("QA — server branch and passthrough contract", () => {
    it("uses type=text/javascript on the server so the parse-time script executes (confirmed-safe, pinned)", () => {
      // The component discriminates on `typeof window` at RENDER time, so stubbing the
      // global before a server-side render exercises the true server branch.
      vi.stubGlobal("window", undefined);
      try {
        const markup = renderToStaticMarkup(<InlineScript html="var x=1;" />);
        expect(markup).toContain('type="text/javascript"');
        expect(markup).toContain("var x=1;");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("passes html through VERBATIM — no escaping; script-safety is the caller's contract (confirmed-safe, pinned)", () => {
      // Pin the passthrough so nobody adds double-escaping here (which would corrupt the
      // baked JS), and so the boundary responsibility stays documented: the html prop must
      // already be script-safe (see themeInitScript's hardening test in theme.test.ts).
      const js = 'console.log("a<b&&c")';
      const { container } = render(<InlineScript html={js} />);
      expect(container.querySelector("script")?.textContent).toBe(js);
    });
  });
});
