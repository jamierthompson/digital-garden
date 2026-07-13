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

  it("falls back to the generic label when the candidate array is empty", () => {
    render(<MediaPlaceholder labelCandidates={[]} fallbackLabel="Figure" />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
  });

  // Locks the a11y-attribute placement against a future Radix change: role="img", the
  // accessible name, AND the styled `.box` class must all sit on the SAME fill element that
  // lives inside the ratio wrapper — not drift onto the wrapper (which would move the visible
  // dressing off the labelled element).
  it("lands role/name/box-class together on the fill element inside the 16:9 wrapper", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["clip"]}
        fallbackLabel="Video"
        ratio={16 / 9}
      />,
    );
    const wrapper = container.querySelector<HTMLElement>(
      "[data-radix-aspect-ratio-wrapper]",
    );
    expect(wrapper).not.toBeNull();
    // 16 / 9 → padding-bottom 56.25% is the reserved-height box that prevents CLS (#128).
    expect(wrapper!.style.paddingBottom).toBe("56.25%");
    const box = screen.getByRole("img", { name: "clip" });
    expect(box.className).toMatch(/box/);
    expect(wrapper).toContainElement(box);
  });

  // QA — DEFECT (chokepoint has a hole): firstNonEmpty returns `fallback` VERBATIM without
  // re-checking it, so an empty/whitespace-only `fallbackLabel` flows straight to aria-label.
  // The commit claims a caller "CANNOT produce a blank name", but this one does — a
  // `role="img"` with a blank accessible name (WCAG 2.2 SC 1.1.1), exactly the footgun the
  // refactor exists to structurally prevent. Not reachable from today's two adapters (literal
  // "Figure"/"Video"), but the next media block's fallback is unguarded. Fix: run the fallback
  // through the same empty-check (or type it so it can't be blank).
  it("never leaves a blank accessible name even when the fallback itself is empty", () => {
    render(
      <MediaPlaceholder labelCandidates={[undefined, "  "]} fallbackLabel="" />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName();
  });

  // QA — DEFECT (doc/behavior mismatch): the `caption` prop JSDoc says "empty/whitespace-only
  // ignored", but the render guard is a bare truthiness check (`caption ? …`), so a
  // whitespace-only caption renders `<figcaption>   </figcaption>` — an empty visible caption
  // element. Either trim before the guard (honor the doc) or drop the doc claim.
  it("emits no figcaption for a whitespace-only caption, per its documented contract", () => {
    const { container } = render(
      <MediaPlaceholder
        labelCandidates={["clip"]}
        fallbackLabel="Video"
        caption="   "
      />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });
});
