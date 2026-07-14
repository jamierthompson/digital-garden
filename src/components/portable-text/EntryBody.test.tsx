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

  it("leaves slots unscoped for a non-project entry (no scope prop)", () => {
    captured.length = 0;
    render(<EntryBody value={BODY} />);
    for (const props of captured) {
      expect(props.scope).toBeUndefined();
    }
  });

  it("renders the prose blocks as plain paragraphs alongside the slots", () => {
    render(<EntryBody value={BODY} scope={SCOPE} />);
    const p = screen.getByText("Editorial prose.");
    expect(p.closest("p")).not.toBeNull();
  });

  // A body prose block can carry the default Sanity `link` annotation. The serializer routes it
  // through `ui/TextLink` (accent variant) so body links wear the editorial ink, never the UA
  // default — and an external target gets safe rel + a new tab.
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

    it("renders an external link as an accent TextLink anchor with safe rel + new tab", () => {
      render(<EntryBody value={linkBlock("https://example.com/x")} />);
      const link = screen.getByRole("link", { name: "see this" });
      expect(link).toHaveAttribute("href", "https://example.com/x");
      expect(link).toHaveAttribute("data-variant", "accent");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
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

    it("treats a protocol-relative //host href as external (safe rel), not as an in-tab relative link", () => {
      render(<EntryBody value={linkBlock("//evil.example/x")} />);
      const link = screen.getByRole("link", { name: "see this" });
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
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
});
