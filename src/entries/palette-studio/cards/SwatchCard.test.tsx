import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("shows the token name, a plain-language badge, value, derivation, contrast, usage, and counterpart", () => {
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
    // The usage line and the one-line counterpart hint.
    expect(screen.getByText(/anything meant to be read/i)).toBeInTheDocument();
    expect(
      screen.getByText(/in dark mode, this switches to the/i),
    ).toBeInTheDocument();
  });

  it("shows the active scheme's face only — dark differs from light, no both-scheme block", () => {
    renderCard("text", "dark");
    expect(screen.getByText(textCard.dark.oklch)).toBeInTheDocument();
    expect(screen.queryByText(textCard.light.oklch)).not.toBeInTheDocument();
    // The counterpart now points back at light.
    expect(
      screen.getByText(/in light mode, this switches to the/i),
    ).toBeInTheDocument();
  });

  it("renders the accent card without a mini-ramp (it is a continuous co-solve)", () => {
    renderCard("accent");
    // No ramp on the face for a co-solve; the plain "brand color" badge is shown.
    expect(screen.getByText("brand color")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

describe("SwatchCard — disclosure (plain-language glossary)", () => {
  it("exposes the glossary behind a real button", () => {
    renderCard("text");
    expect(
      screen.getByRole("button", { name: /what do these terms mean/i }),
    ).toBeInTheDocument();
  });

  it("opens plain-language definitions of the terms the card uses", () => {
    renderCard("text");
    fireEvent.click(
      screen.getByRole("button", { name: /what do these terms mean/i }),
    );
    expect(screen.getByText("--text — in plain terms")).toBeInTheDocument();
    const panel = screen.getByText("--text — in plain terms").closest("div")!;
    // A measured token's glossary defines the scale + both contrast scores.
    expect(within(panel).getByText(/Scale \(ramp\)/i)).toBeInTheDocument();
    expect(
      within(panel).getByText(/Contrast ratio \(WCAG\)/i),
    ).toBeInTheDocument();
    expect(within(panel).getByText(/Lc \(APCA\)/i)).toBeInTheDocument();
  });
});
