import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MediaPlaceholder from "./MediaPlaceholder";

describe("MediaPlaceholder", () => {
  it("names the box with the first non-empty candidate", () => {
    render(
      <MediaPlaceholder
        labelCandidates={[undefined, "A diagram"]}
        fallbackLabel="Figure"
      />,
    );
    expect(screen.getByRole("img", { name: "A diagram" })).toBeInTheDocument();
  });

  // The visible chip names the KIND of deferred media; the descriptor is the box's accessible
  // name only (aria-label), never rendered as visible text — so nothing is shown twice.
  it("shows the media kind as the visible chip, distinct from the accessible name", () => {
    render(
      <MediaPlaceholder
        labelCandidates={["A diagram"]}
        fallbackLabel="Figure"
      />,
    );
    expect(screen.getByText("Figure")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A diagram" })).toBeInTheDocument();
    // The descriptor is not visible text (it lives in aria-label only).
    expect(screen.queryByText("A diagram")).toBeNull();
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
    expect(screen.queryByRole("img", { name: "" })).toBeNull();
  });

  // Even an empty/whitespace-only fallback can't blank the name — a constant backstops it.
  it("never leaves a blank accessible name even when the fallback itself is empty", () => {
    render(
      <MediaPlaceholder labelCandidates={[undefined, "  "]} fallbackLabel="" />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName();
  });

  it("falls back to the generic label when the candidate array is empty", () => {
    render(<MediaPlaceholder labelCandidates={[]} fallbackLabel="Figure" />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
  });

  // The caption honors its documented contract: whitespace-only is not a real caption.
  it("emits no figcaption for a whitespace-only caption", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["clip"]}
        fallbackLabel="Video"
        caption="   "
      />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("renders only placeholder markup — never a navigable/loadable url attribute", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["clip"]}
        fallbackLabel="Video"
        ratio="16 / 9"
      />,
    );
    expect(screen.getByRole("img", { name: "clip" })).toBeInTheDocument();
    expect(container.querySelector("a, [href], [src]")).toBeNull();
  });

  // A fixed ratio is applied via a native CSS aspect-ratio, parameterized by a custom property
  // on the box — no wrapper element, no padding-hack. The role/name/box-class all sit on the
  // one box element that carries the ratio.
  it("parameterizes a native CSS aspect-ratio on the labelled box", () => {
    render(
      <MediaPlaceholder
        labelCandidates={["clip"]}
        fallbackLabel="Video"
        ratio="16 / 9"
      />,
    );
    const box = screen.getByRole("img", { name: "clip" });
    expect(box.style.getPropertyValue("--placeholder-ratio")).toBe("16 / 9");
    expect(box.className).toMatch(/box/);
  });

  it("sets no ratio custom property for variable-ratio media", () => {
    render(
      <MediaPlaceholder labelCandidates={["alt"]} fallbackLabel="Figure" />,
    );
    const box = screen.getByRole("img", { name: "alt" });
    expect(box.style.getPropertyValue("--placeholder-ratio")).toBe("");
  });

  // QA — the placeholder stands in for a media block, so it must hold the SAME lane the real
  // block would have taken; a lane-less placeholder would visibly jump lanes when the media
  // resolves.
  it("stamps data-lane='wide' by default, mirroring the media it stands in for", () => {
    const { container } = render(
      <MediaPlaceholder labelCandidates={["alt"]} fallbackLabel="Figure" />,
    );
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "wide",
    );
  });

  it("stamps the caller's lane on the placeholder figure", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["alt"]}
        fallbackLabel="Figure"
        lane="prose"
      />,
    );
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "prose",
    );
  });
});
