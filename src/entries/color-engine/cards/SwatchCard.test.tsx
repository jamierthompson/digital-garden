import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { derivePalette } from "../core/derive";
import { DEFAULT_RULES } from "../core/rules";
import { buildCards } from "./cardModel";
import SwatchCard from "./SwatchCard";

// Radix Popover positions via Popper, which needs these browser APIs jsdom lacks. Stubbed
// locally (not in the shared setup) so opening the disclosure doesn't throw.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

const cards = buildCards(derivePalette("#7c3aed", DEFAULT_RULES, "srgb"));
const textCard = cards.find((c) => c.name === "text")!;

/** SwatchCard renders an <li>; a bare <li> outside a list warns, so wrap it. */
function renderCard(name: string, scheme: "light" | "dark" = "light") {
  const card = cards.find((c) => c.name === name)!;
  return render(
    <ul>
      <SwatchCard card={card} scheme={scheme} />
    </ul>,
  );
}

describe("SwatchCard — face (single scheme, plain language)", () => {
  it("shows the token name, a plain-language badge, value, derivation, contrast, and usage", () => {
    renderCard("text");
    expect(screen.getByRole("heading", { name: "--text" })).toBeInTheDocument();
    // Plain badge, not "solved" jargon.
    expect(screen.getByText("auto-picked")).toBeInTheDocument();
    // The oklch value of the active (light) face.
    expect(screen.getByText(textCard.light.oklch)).toBeInTheDocument();
    // The derivation sentence reads plainly (the badge also says "auto-picked", so match the
    // sentence by a phrase unique to it).
    expect(
      screen.getByText(/closest shade to the background/i),
    ).toBeInTheDocument();
    // The live contrast reads as passing, with a plain lead word.
    expect(screen.getByText(/measured contrast/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "passes" })).toBeInTheDocument();
    // The usage line.
    expect(screen.getByText(/anything meant to be read/i)).toBeInTheDocument();
    // The shared glossary is NOT repeated on the card — it lives once in the sidebar.
    expect(screen.queryByText(/Scale \(ramp\)/i)).not.toBeInTheDocument();
    // The counterpart hint is behind the disclosure, not on the face.
    expect(
      screen.queryByText(/in dark mode, this switches to the/i),
    ).not.toBeInTheDocument();
  });

  it("shows the active scheme's face only — dark differs from light, no both-scheme block", () => {
    renderCard("text", "dark");
    expect(screen.getByText(textCard.dark.oklch)).toBeInTheDocument();
    expect(screen.queryByText(textCard.light.oklch)).not.toBeInTheDocument();
  });

  it("renders the accent card without a mini-ramp (it is a continuous co-solve)", () => {
    renderCard("accent");
    // No ramp on the face for a co-solve; the plain "signal fill" badge is shown (#160).
    expect(screen.getByText("signal fill")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

describe("SwatchCard — disclosure (this color's own receipt)", () => {
  it("exposes the card's own details behind a real button", () => {
    renderCard("text");
    expect(
      screen.getByRole("button", { name: /more about this color/i }),
    ).toBeInTheDocument();
  });

  it("opens the counterpart hint for the other scheme (not the shared glossary)", () => {
    renderCard("text");
    fireEvent.click(
      screen.getByRole("button", { name: /more about this color/i }),
    );
    // The other-scheme counterpart is the card's OWN detail…
    expect(
      screen.getByText(/in dark mode, this switches to the/i),
    ).toBeInTheDocument();
    // …but the shared term definitions are NOT here (they live in the sidebar).
    expect(screen.queryByText(/Scale \(ramp\)/i)).not.toBeInTheDocument();
  });
});
