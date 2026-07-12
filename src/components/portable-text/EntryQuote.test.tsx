import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryQuote from "./EntryQuote";

describe("EntryQuote", () => {
  it("renders a semantic blockquote with the quote text", () => {
    render(<EntryQuote value={{ text: "The medium is the message." }} />);
    const quote = screen.getByText("The medium is the message.");
    expect(quote.closest("blockquote")).not.toBeNull();
  });

  it("renders the attribution in a <cite> when present", () => {
    const { container } = render(
      <EntryQuote value={{ text: "A quote.", attribution: "M. McLuhan" }} />,
    );
    const cite = container.querySelector("cite");
    expect(cite).not.toBeNull();
    expect(cite).toHaveTextContent("M. McLuhan");
  });

  it("omits the <cite> when there is no attribution", () => {
    const { container } = render(<EntryQuote value={{ text: "A quote." }} />);
    expect(container.querySelector("cite")).toBeNull();
  });

  // The schema requires `text`, but a raw API write can drop it. The block must degrade to
  // nothing rather than emit an empty <blockquote>.
  it("renders nothing when the quote text is absent", () => {
    const { container } = render(<EntryQuote value={{}} />);
    expect(container.querySelector("blockquote")).toBeNull();
  });
});
