import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GlossarySidebar from "./GlossarySidebar";
import { GLOSSARY } from "./glossary";

describe("GlossarySidebar", () => {
  it("renders every glossary term once, as a labelled complementary landmark", () => {
    render(<GlossarySidebar />);
    const aside = screen.getByRole("complementary", {
      name: /glossary/i,
    });
    for (const entry of GLOSSARY) {
      expect(within(aside).getByText(entry.term)).toBeInTheDocument();
    }
  });

  it("defines the terms in a friendly, plain register", () => {
    render(<GlossarySidebar />);
    // "the ramp — the 11 shades we build from your color", that voice.
    expect(
      screen.getByText(/11 shades we build from your color/i),
    ).toBeInTheDocument();
  });
});
