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

  // QA (#250 slot rename): the deploy→migration window. Between deploying this
  // serializer (which keys on `_type: "slot"`) and running the one-time content
  // migration, published bodies can still carry legacy `liveEmbed` blocks. The
  // serializer must degrade — never crash the whole essay on the unknown type.
  describe("unmigrated legacy blocks (the migration window)", () => {
    const LEGACY_BODY = [
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
        _type: "liveEmbed",
        _key: "e1",
        embedKey: "color-engine-seed",
        caption: "legacy caption",
      },
    ] as unknown as Body;

    it("does not throw on a legacy liveEmbed block and keeps rendering the prose", () => {
      captured.length = 0;
      expect(() =>
        render(<EntryBody value={LEGACY_BODY} scope={SCOPE} />),
      ).not.toThrow();
      expect(screen.getByText("Editorial prose.")).toBeInTheDocument();
    });

    it("never routes a legacy liveEmbed block into SlotBlock (it is an unknown type, not a slot)", () => {
      captured.length = 0;
      render(<EntryBody value={LEGACY_BODY} scope={SCOPE} />);
      expect(captured).toHaveLength(0);
      expect(screen.queryByTestId("slot")).toBeNull();
    });
  });
});
