import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
});
