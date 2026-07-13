import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EntryQuote from "./EntryQuote";

describe("EntryQuote", () => {
  it("renders a semantic blockquote with the quote text", () => {
    render(<EntryQuote value={{ text: "The medium is the message." }} />);
    const quote = screen.getByText("The medium is the message.");
    expect(quote.closest("blockquote")).not.toBeNull();
  });

  it("wraps the blockquote in a figure", () => {
    const { container } = render(<EntryQuote value={{ text: "A quote." }} />);
    const figure = container.querySelector("figure");
    expect(figure).not.toBeNull();
    expect(figure!.querySelector("blockquote")).not.toBeNull();
  });

  it("renders the attribution in a figcaption when present", () => {
    const { container } = render(
      <EntryQuote value={{ text: "A quote.", attribution: "M. McLuhan" }} />,
    );
    const figcaption = container.querySelector("figcaption");
    expect(figcaption).not.toBeNull();
    expect(figcaption).toHaveTextContent("M. McLuhan");
  });

  // The spec is explicit: the attribution is NOT part of what was quoted, so the figcaption must
  // sit OUTSIDE the blockquote — a blockquote carries only the quoted content.
  it("places the attribution outside the blockquote", () => {
    const { container } = render(
      <EntryQuote value={{ text: "A quote.", attribution: "M. McLuhan" }} />,
    );
    const blockquote = container.querySelector("blockquote")!;
    expect(blockquote.querySelector("figcaption")).toBeNull();
    expect(blockquote).not.toHaveTextContent("M. McLuhan");
  });

  // `<cite>` is spec'd for the title of a work, not a person's name; the freeform attribution
  // must not be marked up as one.
  it("does not wrap the attribution in a cite element", () => {
    const { container } = render(
      <EntryQuote value={{ text: "A quote.", attribution: "M. McLuhan" }} />,
    );
    expect(container.querySelector("cite")).toBeNull();
  });

  it("omits the attribution figcaption when there is none", () => {
    const { container } = render(<EntryQuote value={{ text: "A quote." }} />);
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // The schema requires `text`, but a raw API write can drop it. The block must degrade to
  // nothing rather than emit an empty quote.
  it("renders nothing when the quote text is absent", () => {
    const { container } = render(<EntryQuote value={{}} />);
    expect(container.querySelector("blockquote")).toBeNull();
    expect(container.querySelector("figure")).toBeNull();
  });

  // An empty string is falsy, so the same "render nothing" contract holds — an empty quote
  // would be noise.
  it("renders nothing when the quote text is an empty string", () => {
    const { container } = render(<EntryQuote value={{ text: "" }} />);
    expect(container.querySelector("blockquote")).toBeNull();
  });

  // Attribution without text must never emit an orphan figcaption in an empty quote.
  it("renders nothing when only an attribution is present", () => {
    const { container } = render(
      <EntryQuote value={{ attribution: "M. McLuhan" }} />,
    );
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("figcaption")).toBeNull();
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
