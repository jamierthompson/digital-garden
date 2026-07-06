// QA #131 — EntryBody threads the host entry's brand-scope seed to EVERY liveEmbed
// while the prose blocks stay plain editorial markup. EmbedBlock (an async RSC) is
// mocked at the module seam so the serializer's prop threading is what's under test.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ScopeSeed } from "@/components/entry-scope/scopeSeed";

import EntryBody from "./EntryBody";

interface CapturedEmbedProps {
  embedKey?: string;
  caption?: string;
  scope?: ScopeSeed;
}

const captured: CapturedEmbedProps[] = [];

vi.mock("./EmbedBlock", () => ({
  default: (props: CapturedEmbedProps) => {
    captured.push(props);
    return <div data-testid="embed" data-embed-key={props.embedKey} />;
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
    _type: "liveEmbed",
    _key: "e1",
    embedKey: "palette-studio-seed",
    caption: "seed caption",
  },
  {
    _type: "liveEmbed",
    _key: "e2",
    embedKey: "palette-studio-tokens",
  },
] as unknown as Body;

const SCOPE: ScopeSeed = {
  slug: "palette-studio",
  fontKey: "jetbrains-mono",
};

describe("EntryBody", () => {
  it("threads the scope seed to every liveEmbed in the body", () => {
    captured.length = 0;
    render(<EntryBody value={BODY} scope={SCOPE} />);
    expect(screen.getAllByTestId("embed")).toHaveLength(2);
    expect(captured.map((p) => p.embedKey)).toEqual([
      "palette-studio-seed",
      "palette-studio-tokens",
    ]);
    for (const props of captured) {
      expect(props.scope).toEqual(SCOPE);
    }
    // The caption passes through per block.
    expect(captured[0]?.caption).toBe("seed caption");
    expect(captured[1]?.caption).toBeUndefined();
  });

  it("leaves embeds unscoped for a non-project entry (no scope prop)", () => {
    captured.length = 0;
    render(<EntryBody value={BODY} />);
    for (const props of captured) {
      expect(props.scope).toBeUndefined();
    }
  });

  it("renders the prose blocks as plain paragraphs alongside the embeds", () => {
    render(<EntryBody value={BODY} scope={SCOPE} />);
    const p = screen.getByText("Editorial prose.");
    expect(p.closest("p")).not.toBeNull();
  });
});
