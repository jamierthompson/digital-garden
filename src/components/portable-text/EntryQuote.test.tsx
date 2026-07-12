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

  // An empty string is falsy, so the same "render nothing" contract holds — an empty
  // <blockquote> would be noise.
  it("renders nothing when the quote text is an empty string", () => {
    const { container } = render(<EntryQuote value={{ text: "" }} />);
    expect(container.querySelector("blockquote")).toBeNull();
  });

  // Attribution without text must never emit an orphan <cite> in an empty quote.
  it("renders nothing when only an attribution is present", () => {
    const { container } = render(
      <EntryQuote value={{ attribution: "M. McLuhan" }} />,
    );
    expect(container.querySelector("blockquote")).toBeNull();
    expect(container.querySelector("cite")).toBeNull();
  });

  // XSS: authored text is untrusted. React escapes children, so markup in the quote text or
  // attribution must render as literal text, never as injected DOM.
  it("renders HTML in text and attribution as inert literal text", () => {
    const { container } = render(
      <EntryQuote
        value={{
          text: "<img src=x onerror=alert(1)>",
          attribution: "<script>alert(2)</script>",
        }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
  });
});
