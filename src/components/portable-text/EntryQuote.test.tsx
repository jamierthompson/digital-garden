import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EntryQuote from "./EntryQuote";

type QuoteValue = Parameters<typeof EntryQuote>[0]["value"];

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

  // Whitespace-only text is treated as absent too (via `isNonBlank`) — otherwise it renders an
  // empty-looking pull-quote (accent border + blank body), the exact noise the block must avoid.
  it("renders nothing for whitespace-only quote text", () => {
    const { container } = render(<EntryQuote value={{ text: "  \n  " }} />);
    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("blockquote")).toBeNull();
  });

  // A whitespace-only attribution is not a real attribution — no figcaption (and so no dangling
  // decorative em-dash attributed to nobody).
  it("emits no figcaption for a whitespace-only attribution", () => {
    const { container } = render(
      <EntryQuote value={{ text: "A quote.", attribution: "   " }} />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
  });

  // Totality: content can drift in SHAPE, not just presence — a raw API write can put any JSON
  // where `text` should be. An object is truthy, so without the guard it reaches React children
  // and throws "Objects are not valid as a React child", crashing the whole article. The block
  // must degrade to nothing instead.
  it("renders nothing (not a crash) when text drifts to a non-string shape", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const drifted = {
      text: { _type: "localeString", en: "Quote" },
    } as unknown as QuoteValue;
    expect(() => render(<EntryQuote value={drifted} />)).not.toThrow();
    spy.mockRestore();
  });

  // Same drift class on the optional field: a non-string attribution must not reach React
  // children — text renders, attribution is dropped.
  it("drops (not crashes on) an attribution drifted to a non-string shape", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const drifted = {
      text: "A quote.",
      attribution: { name: "M. McLuhan" },
    } as unknown as QuoteValue;
    expect(() => render(<EntryQuote value={drifted} />)).not.toThrow();
    expect(screen.getByText("A quote.")).toBeInTheDocument();
    spy.mockRestore();
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
