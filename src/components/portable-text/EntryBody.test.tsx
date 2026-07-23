// QA #131 — EntryBody threads the host entry's theme-scope seed to EVERY slot
// while the prose blocks stay plain editorial markup. SlotBlock (an async RSC) is
// mocked at the module seam so the serializer's prop threading is what's under test.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";

import EntryBody from "./EntryBody";

interface CapturedSlotProps {
  slotKey?: string;
  caption?: string;
  lane?: string | null;
  scope?: ScopeSeed;
}

const captured: CapturedSlotProps[] = [];

vi.mock("./SlotBlock", () => ({
  default: (props: CapturedSlotProps) => {
    captured.push(props);
    return <div data-testid="slot" data-slot-key={props.slotKey} />;
  },
}));

type Body = Parameters<typeof EntryBody>[0]["value"];

const BODY = [
  {
    _type: "block",
    _key: "b1",
    style: "normal",
    markDefs: [],
    children: [
      { _type: "span", _key: "s1", text: "Editorial prose.", marks: [] },
    ],
  },
  {
    _type: "slot",
    _key: "e1",
    slotKey: "color-engine-seed",
    caption: "seed caption",
  },
  {
    _type: "slot",
    _key: "e2",
    slotKey: "color-engine-tokens",
  },
] as unknown as Body;

const SCOPE: ScopeSeed = {
  slug: "color-engine",
  bodyFont: "space-grotesk",
};

describe("EntryBody", () => {
  it("threads the scope seed to every slot in the body", () => {
    captured.length = 0;
    render(<EntryBody value={BODY} scope={SCOPE} />);
    expect(screen.getAllByTestId("slot")).toHaveLength(2);
    expect(captured.map((p) => p.slotKey)).toEqual([
      "color-engine-seed",
      "color-engine-tokens",
    ]);
    for (const props of captured) {
      expect(props.scope).toEqual(SCOPE);
    }
    // The caption passes through per block.
    expect(captured[0]?.caption).toBe("seed caption");
    expect(captured[1]?.caption).toBeUndefined();
  });

  it("leaves slots unscoped when the page threads no scope prop", () => {
    captured.length = 0;
    render(<EntryBody value={BODY} />);
    for (const props of captured) {
      expect(props.scope).toBeUndefined();
    }
  });

  it("renders the prose blocks as paragraphs alongside the slots", () => {
    render(<EntryBody value={BODY} scope={SCOPE} />);
    const p = screen.getByText("Editorial prose.");
    expect(p.closest("p")).not.toBeNull();
  });

  describe("the lede — the body's first paragraph", () => {
    const PROSE = [
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "s1", text: "The lede.", marks: [] }],
      },
      {
        _type: "block",
        _key: "b2",
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: "s2", text: "The rest.", marks: [] }],
      },
    ] as unknown as Body;

    it("styles the first paragraph as the lede (variant=lede), the rest as plain prose", () => {
      render(<EntryBody value={PROSE} />);
      const lede = screen.getByText("The lede.").closest("p");
      const rest = screen.getByText("The rest.").closest("p");
      expect(lede).toHaveAttribute("data-variant", "lede");
      expect(rest).not.toHaveAttribute("data-variant");
    });

    it("promotes the first PARAGRAPH even when a non-paragraph block precedes it", () => {
      const withLeadingSlot = [
        { _type: "slot", _key: "e0", slotKey: "color-engine-seed" },
        ...PROSE,
      ] as unknown as Body;
      render(<EntryBody value={withLeadingSlot} />);
      expect(screen.getByText("The lede.").closest("p")).toHaveAttribute(
        "data-variant",
        "lede",
      );
      expect(screen.getByText("The rest.").closest("p")).not.toHaveAttribute(
        "data-variant",
      );
    });

    it("promotes no lede when the body has no paragraph at all (only slots)", () => {
      const noProse = [
        { _type: "slot", _key: "e1", slotKey: "color-engine-seed" },
        { _type: "slot", _key: "e2", slotKey: "color-engine-tokens" },
      ] as unknown as Body;
      const { container } = render(<EntryBody value={noProse} />);
      expect(container.querySelector('[data-variant="lede"]')).toBeNull();
    });

    it("does not treat a heading as the lede — only a normal paragraph", () => {
      const headingFirst = [
        {
          _type: "block",
          _key: "h1",
          style: "h2",
          markDefs: [],
          children: [
            { _type: "span", _key: "hs", text: "A heading.", marks: [] },
          ],
        },
        ...PROSE,
      ] as unknown as Body;
      render(<EntryBody value={headingFirst} />);
      // The h2 is not promoted; the first normal paragraph still is.
      expect(screen.getByText("A heading.").closest("p")).toBeNull();
      expect(screen.getByText("The lede.").closest("p")).toHaveAttribute(
        "data-variant",
        "lede",
      );
    });
  });

  // A body prose block can carry the default Sanity `link` annotation. The serializer routes it
  // through `ui/TextLink` (accent variant) so body links wear the editorial ink, never the UA
  // default. The contract is deliberately minimal: the authored href verbatim, same tab, no
  // synthesized target/rel.
  describe("the default link mark", () => {
    const linkBlock = (href: string) =>
      [
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          markDefs: [{ _type: "link", _key: "m1", href }],
          children: [
            { _type: "span", _key: "s1", text: "see this", marks: ["m1"] },
          ],
        },
      ] as unknown as Body;

    it("renders an absolute link as an accent TextLink anchor, same tab, no synthesized rel/target", () => {
      render(<EntryBody value={linkBlock("https://example.com/x")} />);
      const link = screen.getByRole("link", { name: "see this" });
      expect(link).toHaveAttribute("href", "https://example.com/x");
      expect(link).toHaveAttribute("data-variant", "accent");
      expect(link).not.toHaveAttribute("rel");
      expect(link).not.toHaveAttribute("target");
    });

    it("keeps a relative link in-tab (no target/rel), still an accent TextLink", () => {
      render(<EntryBody value={linkBlock("/some-entry")} />);
      const link = screen.getByRole("link", { name: "see this" });
      expect(link).toHaveAttribute("href", "/some-entry");
      expect(link).toHaveAttribute("data-variant", "accent");
      expect(link).not.toHaveAttribute("target");
      expect(link).not.toHaveAttribute("rel");
    });
  });

  describe("adversarial QA round 2 — hostile / edge link-mark hrefs", () => {
    const linkBlock = (href: unknown) =>
      [
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          markDefs: [{ _type: "link", _key: "m1", href }],
          children: [
            { _type: "span", _key: "s1", text: "see this", marks: ["m1"] },
          ],
        },
      ] as unknown as Body;

    it("a hostile javascript: href never survives to the DOM (React 19 sanitizeURL is the active defense — the serializer itself does not filter schemes)", () => {
      // Raw Content Lake writes bypass Studio validation, so a javascript: href can exist in
      // the dataset. React 19 rewrites it to an inert throwing stub in BOTH the production
      // client and server builds (react-dom sanitizeURL) — the payload must never survive.
      render(
        <EntryBody value={linkBlock("javascript:alert(document.domain)")} />,
      );
      const link = screen.getByText("see this").closest("a");
      expect(link?.getAttribute("href")).not.toContain("alert");
    });

    it("renders a protocol-relative //host href verbatim under the minimal contract (no classification to spoof)", () => {
      render(<EntryBody value={linkBlock("//evil.example/x")} />);
      const link = screen.getByRole("link", { name: "see this" });
      expect(link).toHaveAttribute("href", "//evil.example/x");
      expect(link).not.toHaveAttribute("target");
    });

    it("does not render a self-navigating href='' link when the annotation has no href", () => {
      render(<EntryBody value={linkBlock(undefined)} />);
      const anchor = screen.getByText("see this").closest("a");
      // Either no anchor at all, or an anchor without href (not a link role) is acceptable;
      // href="" is a link back to the current page — a trap for keyboard/AT users.
      expect(anchor?.getAttribute("href")).not.toBe("");
    });

    it("keeps a mailto: href in-tab with no target (not misdecorated as external)", () => {
      render(<EntryBody value={linkBlock("mailto:hi@example.com")} />);
      const link = screen.getByRole("link", { name: "see this" });
      expect(link).toHaveAttribute("href", "mailto:hi@example.com");
      expect(link).not.toHaveAttribute("target");
    });
  });

  // The shared palette carries two typed non-slot blocks — `video` and `quote`. The
  // serializer routes each to its own renderer (real components, not mocked here) rather
  // than dropping it or misrouting it into a slot.
  describe("the typed video and quote blocks", () => {
    const MEDIA_BODY = [
      {
        _type: "quote",
        _key: "q1",
        text: "A pull quote.",
        attribution: "Someone",
      },
      {
        _type: "video",
        _key: "v1",
        url: "https://cdn.sanity.io/files/p/d/v.mp4",
        caption: "A clip",
      },
    ] as unknown as Body;

    it("routes a quote block to a semantic blockquote with an outside attribution", () => {
      captured.length = 0;
      render(<EntryBody value={MEDIA_BODY} scope={SCOPE} />);
      expect(
        screen.getByText("A pull quote.").closest("blockquote"),
      ).not.toBeNull();
      expect(screen.getByText("Someone").closest("figcaption")).not.toBeNull();
    });

    it("routes a video block to its captioned embed", () => {
      captured.length = 0;
      const { container } = render(
        <EntryBody value={MEDIA_BODY} scope={SCOPE} />,
      );
      const video = container.querySelector("video");
      expect(video?.getAttribute("src")).toBe(
        "https://cdn.sanity.io/files/p/d/v.mp4",
      );
      expect(video?.getAttribute("aria-label")).toBe("A clip");
      expect(screen.getByText("A clip").closest("figcaption")).not.toBeNull();
    });

    it("never routes a video or quote block into SlotBlock", () => {
      captured.length = 0;
      render(<EntryBody value={MEDIA_BODY} scope={SCOPE} />);
      expect(captured).toHaveLength(0);
      expect(screen.queryByTestId("slot")).toBeNull();
    });

    // Integration: the whole shared palette in one body — prose · figure · video · slot ·
    // quote plus a drifted unknown — must render totally, each block to its own renderer,
    // with the slot still threaded and the unknown silently dropped.
    it("renders the full mixed palette totally in one body", () => {
      const FULL_BODY = [
        {
          _type: "block",
          _key: "b1",
          style: "normal",
          markDefs: [],
          children: [
            { _type: "span", _key: "s1", text: "Editorial prose.", marks: [] },
          ],
        },
        { _type: "figure", _key: "f1", alt: "A figure", caption: "Fig cap" },
        {
          _type: "video",
          _key: "v1",
          url: "https://cdn.sanity.io/files/p/d/reel.mp4",
          caption: "Clip",
        },
        { _type: "slot", _key: "e1", slotKey: "color-engine-seed" },
        { _type: "quote", _key: "q1", text: "Quoted.", attribution: "Author" },
        { _type: "unknownBlock", _key: "u1" },
      ] as unknown as Body;

      captured.length = 0;
      expect(() =>
        render(<EntryBody value={FULL_BODY} scope={SCOPE} />),
      ).not.toThrow();
      expect(screen.getByText("Editorial prose.")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "A figure" })).toBeInTheDocument();
      expect(document.querySelector("video")?.getAttribute("src")).toBe(
        "https://cdn.sanity.io/files/p/d/reel.mp4",
      );
      expect(screen.getByText("Clip").closest("figcaption")).not.toBeNull();
      expect(screen.getByText("Quoted.").closest("blockquote")).not.toBeNull();
      expect(screen.getByTestId("slot")).toHaveAttribute(
        "data-slot-key",
        "color-engine-seed",
      );
      expect(captured[0]?.scope).toEqual(SCOPE);
    });
  });

  // The first body block is the likely LCP element when it's a figure. The serializer threads
  // `preload` to that figure ONLY — pinned here at the body layer (not just in the adapter's
  // own tests) so deleting the threading breaks a test, not just the paint.
  describe("figure preload threading", () => {
    const ASSET = {
      _id: "image-abc123def456-1200x800-jpg",
      metadata: {
        lqip: null,
        dimensions: {
          _type: "sanity.imageDimensions",
          width: 1200,
          height: 800,
          aspectRatio: 1.5,
        },
      },
    };
    const FIGURES_BODY = [
      { _type: "figure", _key: "f1", alt: "First figure", asset: ASSET },
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "s1", text: "Editorial prose.", marks: [] },
        ],
      },
      { _type: "figure", _key: "f2", alt: "Second figure", asset: ASSET },
    ] as unknown as Body;

    it("preloads only the first-block figure; later figures lazy-load", () => {
      render(<EntryBody value={FIGURES_BODY} />);
      expect(
        screen.getByRole("img", { name: "First figure" }),
      ).not.toHaveAttribute("loading", "lazy");
      expect(
        screen.getByRole("img", { name: "Second figure" }),
      ).toHaveAttribute("loading", "lazy");
    });

    // QA #322 — `preload` keys on the block's absolute index, not on "is this the first figure".
    // When prose leads, the sole figure sits below the fold and must stay lazy — otherwise a
    // preload <link> would compete with the true LCP element for the critical path.
    const PROSE_FIRST_BODY = [
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "s1", text: "Editorial prose.", marks: [] },
        ],
      },
      { _type: "figure", _key: "f1", alt: "Below-fold figure", asset: ASSET },
    ] as unknown as Body;

    it("does not preload a figure that follows a non-figure first block", () => {
      render(<EntryBody value={PROSE_FIRST_BODY} />);
      expect(
        screen.getByRole("img", { name: "Below-fold figure" }),
      ).toHaveAttribute("loading", "lazy");
    });
  });

  // Content can drift from code: a published body may carry a block whose `_type` the serializer
  // doesn't handle — a type removed from code, or authored ahead of a code change. The serializer
  // must degrade: render the rest of the essay, never crash on the unknown type, and never
  // misroute it into a slot.
  describe("an unknown block type (content drifted from code)", () => {
    const DRIFTED_BODY = [
      {
        _type: "block",
        _key: "b1",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "s1", text: "Editorial prose.", marks: [] },
        ],
      },
      {
        _type: "unknownBlock",
        _key: "u1",
      },
    ] as unknown as Body;

    it("does not throw on an unknown block type and keeps rendering the prose", () => {
      captured.length = 0;
      expect(() =>
        render(<EntryBody value={DRIFTED_BODY} scope={SCOPE} />),
      ).not.toThrow();
      expect(screen.getByText("Editorial prose.")).toBeInTheDocument();
    });

    it("never routes an unknown block type into SlotBlock", () => {
      captured.length = 0;
      render(<EntryBody value={DRIFTED_BODY} scope={SCOPE} />);
      expect(captured).toHaveLength(0);
      expect(screen.queryByTestId("slot")).toBeNull();
    });
  });

  // QA — the authored lane must survive the serializer seam for every block type that
  // carries it: slots (threaded as a prop for SlotBlock to sanitize), figures and videos
  // (sanitized and stamped by their components). A dropped lane silently strands every
  // authored full-bleed block in the wide default.
  describe("lane threading through the serializer", () => {
    it("threads each slot block's authored lane (verbatim — SlotBlock owns sanitizing)", () => {
      captured.length = 0;
      const body = [
        { _type: "slot", _key: "e1", slotKey: "a", lane: "full" },
        { _type: "slot", _key: "e2", slotKey: "b" },
      ] as unknown as Body;
      render(<EntryBody value={body} scope={SCOPE} />);
      expect(captured.map((p) => p.lane)).toEqual(["full", undefined]);
    });

    it("stamps an authored figure lane on the rendered figure (placeholder path)", () => {
      const body = [
        { _type: "figure", _key: "f1", asset: null, lane: "full" },
      ] as unknown as Body;
      const { container } = render(<EntryBody value={body} scope={SCOPE} />);
      expect(container.querySelector("figure")).toHaveAttribute(
        "data-lane",
        "full",
      );
    });

    it("stamps an authored video lane on the rendered embed", () => {
      const body = [
        {
          _type: "video",
          _key: "v1",
          url: "https://cdn.sanity.io/files/p/d/v.mp4",
          lane: "prose",
        },
      ] as unknown as Body;
      const { container } = render(<EntryBody value={body} scope={SCOPE} />);
      expect(container.querySelector("figure")).toHaveAttribute(
        "data-lane",
        "prose",
      );
    });
  });
});
