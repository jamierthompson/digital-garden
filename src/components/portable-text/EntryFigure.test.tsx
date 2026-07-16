import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EntryFigure from "./EntryFigure";

type FigureValue = Parameters<typeof EntryFigure>[0]["value"];

/** A complete, well-formed asset as the detail query projects it (id encodes 1200×800). */
const REAL_ASSET: NonNullable<FigureValue["asset"]> = {
  _id: "image-abc123def456-1200x800-jpg",
  metadata: {
    lqip: "data:image/jpeg;base64,LQIP",
    dimensions: {
      _type: "sanity.imageDimensions",
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    },
  },
};

function figureValue(overrides: Partial<FigureValue> = {}): FigureValue {
  return {
    _key: "fig1",
    _type: "figure",
    asset: REAL_ASSET,
    alt: "A wide diagram",
    ...overrides,
  };
}

/** The rendered img's src decoded back out of the optimizer's `?url=` wrapping. */
function decodedSrc(img: HTMLElement): string {
  return decodeURIComponent(img.getAttribute("src") ?? "");
}

describe("EntryFigure with a resolvable asset", () => {
  it("renders a real image off the Sanity CDN, named by the alt", () => {
    render(<EntryFigure value={figureValue()} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(img.tagName).toBe("IMG");
    expect(decodedSrc(img)).toContain(
      "cdn.sanity.io/images/test-project/test-dataset/abc123def456-1200x800.jpg",
    );
  });

  it("reserves the intrinsic box — width/height from the asset metadata", () => {
    render(<EntryFigure value={figureValue()} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
  });

  it("shows the caption once, in the figcaption — never doubled into the name", () => {
    const { container } = render(
      <EntryFigure value={figureValue({ caption: "Fig. 1" })} />,
    );
    expect(container.querySelector("figcaption")).toHaveTextContent("Fig. 1");
    expect(screen.getAllByText("Fig. 1")).toHaveLength(1);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }),
    ).toBeInTheDocument();
  });

  // The authored crop is a real edit: the CDN must serve the cropped pixels (rect=) AND the
  // reserved box must match them — a full-size box around cropped pixels would letterbox/shift.
  it("bakes the authored crop into the URL and reserves the POST-crop box", () => {
    const cropped = figureValue({
      crop: {
        _type: "sanity.imageCrop",
        top: 0.25,
        bottom: 0.25,
        left: 0,
        right: 0,
      },
    });
    render(<EntryFigure value={cropped} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(decodedSrc(img)).toContain("rect=0,200,1200,400");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("400");
  });

  // A malformed crop (reachable via a raw Content Lake write) is DROPPED, not passed through —
  // the builder would bake its broken math into `rect=` and the CDN would 400.
  it("drops a malformed crop and renders the uncropped image", () => {
    const malformed = figureValue({
      crop: {
        _type: "sanity.imageCrop",
        top: 2,
        bottom: 0.25,
        left: 0,
        right: 0,
      },
    });
    render(<EntryFigure value={malformed} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(decodedSrc(img)).not.toContain("rect=");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
  });

  it("blurs up from the asset's LQIP", () => {
    render(<EntryFigure value={figureValue()} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(img.style.backgroundImage).not.toBe("");
  });

  it("skips the blur placeholder when the asset has no LQIP", () => {
    const noLqip = figureValue({
      asset: {
        ...REAL_ASSET,
        metadata: { ...REAL_ASSET.metadata!, lqip: null },
      },
    });
    render(<EntryFigure value={noLqip} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(img.style.backgroundImage).toBe("");
  });

  it("pins the prose-column sizes contract", () => {
    render(<EntryFigure value={figureValue()} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(img.getAttribute("sizes")).toBe("(max-width: 48rem) 100vw, 48rem");
  });

  // preload marks the likely-LCP figure: not lazy (no loading="lazy"), everything else lazy.
  it("lazy-loads by default and switches eager when preloaded", () => {
    const { unmount } = render(<EntryFigure value={figureValue()} />);
    expect(screen.getByRole("img", { name: "A wide diagram" })).toHaveAttribute(
      "loading",
      "lazy",
    );
    unmount();
    render(<EntryFigure value={figureValue()} preload />);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }),
    ).not.toHaveAttribute("loading", "lazy");
  });

  // The alt is schema-required, but a raw write can blank it — the accessible name falls back
  // to the generic kind rather than shipping a nameless image (WCAG 2.2 SC 1.1.1).
  it("never leaves a blank accessible name for a blank alt", () => {
    render(<EntryFigure value={figureValue({ alt: "  " })} />);
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
  });
});

describe("EntryFigure placeholder fallback", () => {
  it("falls back when the asset is missing, named by the alt", () => {
    const { container } = render(
      <EntryFigure value={figureValue({ asset: null, caption: "Fig. 1" })} />,
    );
    const box = screen.getByRole("img", { name: "A wide diagram" });
    expect(box.tagName).not.toBe("IMG");
    expect(container.querySelector("figcaption")).toHaveTextContent("Fig. 1");
  });

  it("falls back when the asset has no usable dimensions", () => {
    const noDims = figureValue({
      asset: { ...REAL_ASSET, metadata: null },
    });
    render(<EntryFigure value={noDims} />);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }).tagName,
    ).not.toBe("IMG");
  });

  it("falls back when the asset id is malformed — the builder never throws through", () => {
    const badId = figureValue({
      asset: { ...REAL_ASSET, _id: "not-an-image-id" },
    });
    expect(() => render(<EntryFigure value={badId} />)).not.toThrow();
    expect(
      screen.getByRole("img", { name: "A wide diagram" }).tagName,
    ).not.toBe("IMG");
  });

  it("labels the box generically when there is no alt, caption in the figcaption", () => {
    const { container } = render(
      <EntryFigure
        value={figureValue({
          asset: null,
          alt: undefined,
          caption: "Just a caption",
        })}
      />,
    );
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "Just a caption",
    );
    expect(screen.getAllByText("Just a caption")).toHaveLength(1);
  });

  // Shape drift, not just missing fields: a raw Content Lake write can put any JSON where the
  // alt string should be. A non-string alt must be skipped (generic name), never crash.
  it("survives an alt drifted to a non-string shape", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const drifted = figureValue({
      asset: null,
      alt: { en: "A diagram" },
    } as unknown as Partial<FigureValue>);
    expect(() => render(<EntryFigure value={drifted} />)).not.toThrow();
    expect(screen.getByRole("img", { name: "Figure" })).toBeInTheDocument();
    spy.mockRestore();
  });
});
