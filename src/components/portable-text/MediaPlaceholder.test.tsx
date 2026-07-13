import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MediaPlaceholder from "./MediaPlaceholder";

describe("MediaPlaceholder", () => {
  it("names the box with the first non-empty candidate", () => {
    render(
      <MediaPlaceholder
        labelCandidates={[undefined, "A caption"]}
        fallbackLabel="Figure"
      />,
    );
    expect(screen.getByRole("img", { name: "A caption" })).toBeInTheDocument();
  });

  it("shows the caption as a figcaption when present", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["alt"]}
        fallbackLabel="Figure"
        caption="Fig. 1"
      />,
    );
    expect(container.querySelector("figcaption")).toHaveTextContent("Fig. 1");
  });

  it("emits no figcaption when there is no caption", () => {
    const { container } = render(
      <MediaPlaceholder labelCandidates={["alt"]} fallbackLabel="Figure" />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // The enforced guard: no combination of empty/whitespace/absent candidates can leave the
  // role="img" box with a blank accessible name — it always resolves to the fallback.
  it("never leaves a blank accessible name, whatever the candidates", () => {
    render(
      <MediaPlaceholder
        labelCandidates={[undefined, "", "   "]}
        fallbackLabel="Video"
      />,
    );
    expect(screen.getByRole("img", { name: "Video" })).toBeInTheDocument();
    // No accessible image with an empty name slipped through.
    expect(screen.queryByRole("img", { name: "" })).toBeNull();
  });

  it("renders only placeholder markup — never a navigable/loadable url attribute", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["clip"]}
        fallbackLabel="Video"
        ratio={16 / 9}
      />,
    );
    // The box is a role="img" stand-in; the deferred embed must not reach an href/src.
    expect(screen.getByRole("img", { name: "clip" })).toBeInTheDocument();
    expect(container.querySelector("a, [href], [src]")).toBeNull();
  });
});
