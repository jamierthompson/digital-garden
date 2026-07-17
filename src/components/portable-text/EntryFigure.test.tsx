import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WIDTH_CONTENT } from "@/styles/foundation/dimension";

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

  // Both forms compose from the drift-guarded --width-content mirror (never a literal):
  // lazy leads with `auto` (browser measures the real box; fallback list for browsers
  // without auto support); the preloaded figure fetches pre-layout, so it gets the plain
  // fallback form — `auto` is spec-invalid on an eager image.
  it("pins the sizes contract: auto-first when lazy, plain fallback when preloaded", () => {
    const fallback = `(max-width: ${WIDTH_CONTENT}) 100vw, ${WIDTH_CONTENT}`;
    const { unmount } = render(<EntryFigure value={figureValue()} />);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }).getAttribute("sizes"),
    ).toBe(`auto, ${fallback}`);
    unmount();
    render(<EntryFigure value={figureValue()} preload />);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }).getAttribute("sizes"),
    ).toBe(fallback);
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

  // QA #322 — the a11y backstop must also hold on the REAL-image path: a raw write can drift
  // `alt` to any JSON shape while the asset stays resolvable, so the rendered <img> must get the
  // generic name (never an object stringified into the accessible name, never blank).
  it("backstops the accessible name on the image path when alt drifts to a non-string", () => {
    render(
      <EntryFigure
        value={figureValue({
          alt: { en: "A diagram" },
        } as unknown as Partial<FigureValue>)}
      />,
    );
    const img = screen.getByRole("img", { name: "Figure" });
    expect(img.tagName).toBe("IMG");
  });

  // QA #322 — an image that went through Sanity's crop UI without cropping carries a present but
  // all-zero crop. It must render identically to no crop: full box, no degenerate `rect=`.
  it("treats an all-zero crop as no crop — full box, no rect", () => {
    const zeroCrop = figureValue({
      crop: {
        _type: "sanity.imageCrop",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });
    render(<EntryFigure value={zeroCrop} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(decodedSrc(img)).not.toContain("rect=");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
  });

  // QA #322 — the malformed-crop guard has three distinct rejection branches; the author only
  // pinned the out-of-range (>1) one. A negative edge is the `< 0` branch.
  it("drops a crop with a negative edge and renders uncropped", () => {
    const negative = figureValue({
      crop: {
        _type: "sanity.imageCrop",
        top: -0.1,
        bottom: 0,
        left: 0,
        right: 0,
      },
    });
    render(<EntryFigure value={negative} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(decodedSrc(img)).not.toContain("rect=");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
  });

  // QA #322 — the per-axis-sum branch: two in-range edges that together erase the axis. A crop
  // baked from this would give the CDN a zero/negative-width `rect=`.
  it("drops a crop whose horizontal edges sum past the frame", () => {
    const overCropped = figureValue({
      crop: {
        _type: "sanity.imageCrop",
        top: 0,
        bottom: 0,
        left: 0.6,
        right: 0.6,
      },
    });
    render(<EntryFigure value={overCropped} />);
    const img = screen.getByRole("img", { name: "A wide diagram" });
    expect(decodedSrc(img)).not.toContain("rect=");
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
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

  // QA #322 — an empty-string id is a distinct guard branch from a mis-shaped id; it must degrade
  // rather than reach the builder with a blank source.
  it("falls back when the asset id is an empty string", () => {
    const emptyId = figureValue({
      asset: { ...REAL_ASSET, _id: "" },
    });
    render(<EntryFigure value={emptyId} />);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }).tagName,
    ).not.toBe("IMG");
  });

  // QA #322 — a non-positive dimension (raw write) can't reserve a real box; degrade instead of
  // emitting width="0"/negative onto the <img>.
  it("falls back when a metadata dimension is zero", () => {
    const zeroDim = figureValue({
      asset: {
        ...REAL_ASSET,
        metadata: {
          ...REAL_ASSET.metadata!,
          dimensions: {
            ...REAL_ASSET.metadata!.dimensions!,
            width: 0,
          },
        },
      },
    });
    render(<EntryFigure value={zeroDim} />);
    expect(
      screen.getByRole("img", { name: "A wide diagram" }).tagName,
    ).not.toBe("IMG");
  });

  // QA #322 — the `width < 1` guard: a valid crop on a tiny source can round the post-crop box
  // below one pixel. That box would reserve nothing, so the figure degrades to the placeholder.
  it("falls back when the post-crop box rounds below one pixel", () => {
    const subPixel = figureValue({
      asset: {
        ...REAL_ASSET,
        metadata: {
          ...REAL_ASSET.metadata!,
          dimensions: {
            ...REAL_ASSET.metadata!.dimensions!,
            width: 1,
            height: 1000,
          },
        },
      },
      crop: {
        _type: "sanity.imageCrop",
        top: 0,
        bottom: 0,
        left: 0.6,
        right: 0,
      },
    });
    render(<EntryFigure value={subPixel} />);
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

// QA — the authored lane rides the figure block over the wire as a plain string, so it must be
// sanitized here and land on BOTH render paths (real image and placeholder), or the block
// jumps lanes depending on whether its asset resolved.
describe("EntryFigure lane threading", () => {
  it("defaults the rendered figure to the wide lane", () => {
    const { container } = render(<EntryFigure value={figureValue()} />);
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "wide",
    );
  });

  it("honors an authored full/prose lane on the real image path", () => {
    for (const lane of ["full", "prose"] as const) {
      const { container, unmount } = render(
        <EntryFigure value={figureValue({ lane })} />,
      );
      expect(container.querySelector("figure"), lane).toHaveAttribute(
        "data-lane",
        lane,
      );
      unmount();
    }
  });

  it("collapses a drifted/hostile lane value to wide", () => {
    const { container } = render(
      <EntryFigure
        value={figureValue({
          lane: 'full"]{}body{display:none}',
        } as unknown as Partial<FigureValue>)}
      />,
    );
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "wide",
    );
  });

  it("keeps the authored lane on the placeholder path (no resolvable asset)", () => {
    const { container } = render(
      <EntryFigure value={figureValue({ asset: null, lane: "full" })} />,
    );
    expect(container.querySelector("figure")).toHaveAttribute(
      "data-lane",
      "full",
    );
  });
});
