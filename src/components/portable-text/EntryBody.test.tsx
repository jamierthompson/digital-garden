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
        url: "https://example.com/v.mp4",
        caption: "A clip",
      },
    ] as unknown as Body;

    it("routes a quote block to a semantic blockquote", () => {
      captured.length = 0;
      render(<EntryBody value={MEDIA_BODY} scope={SCOPE} />);
      expect(
        screen.getByText("A pull quote.").closest("blockquote"),
      ).not.toBeNull();
      expect(screen.getByText("Someone").closest("cite")).not.toBeNull();
    });

    it("routes a video block to its captioned placeholder", () => {
      captured.length = 0;
      render(<EntryBody value={MEDIA_BODY} scope={SCOPE} />);
      expect(screen.getByRole("img", { name: "A clip" })).toBeInTheDocument();
    });

    it("never routes a video or quote block into SlotBlock", () => {
      captured.length = 0;
      render(<EntryBody value={MEDIA_BODY} scope={SCOPE} />);
      expect(captured).toHaveLength(0);
      expect(screen.queryByTestId("slot")).toBeNull();
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
