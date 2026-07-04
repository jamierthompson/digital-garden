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

describe("SwatchCard — face", () => {
  it("shows the token name, kind badge, value, derivation, contrast, and usage", () => {
    renderCard("text");
    expect(screen.getByRole("heading", { name: "--text" })).toBeInTheDocument();
    expect(screen.getByText("solved")).toBeInTheDocument();
    // The oklch value of the active (light) face.
    expect(screen.getByText(textCard.light.oklch)).toBeInTheDocument();
    // The derivation sentence names the bound step.
    expect(screen.getByText(/Bound to neutral ·/)).toBeInTheDocument();
    // The live contrast reads as passing.
    expect(screen.getByRole("img", { name: "passes" })).toBeInTheDocument();
    // The usage line.
    expect(screen.getByText(/anything meant to be read/i)).toBeInTheDocument();
  });

  it("shows the active scheme's face — dark differs from light", () => {
    renderCard("text", "dark");
    expect(screen.getByText(textCard.dark.oklch)).toBeInTheDocument();
    expect(screen.queryByText(textCard.light.oklch)).not.toBeInTheDocument();
  });

  it("renders the accent card without a mini-ramp (it is a continuous co-solve)", () => {
    renderCard("accent");
    // No ramp group on the face for a co-solve, but the co-solve badge is shown.
    expect(screen.getByText("co-solved")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

describe("SwatchCard — disclosure", () => {
  it("exposes the full receipt behind a real button", () => {
    renderCard("text");
    expect(
      screen.getByRole("button", { name: /full receipt/i }),
    ).toBeInTheDocument();
  });

  it("opens the both-scheme receipt on activation", () => {
    renderCard("text");
    fireEvent.click(screen.getByRole("button", { name: /full receipt/i }));
    // The preview heading and both scheme detail blocks appear.
    expect(screen.getByText("--text — both schemes")).toBeInTheDocument();
    const disclosure = screen
      .getByText("--text — both schemes")
      .closest("div")!;
    expect(within(disclosure).getByText("light")).toBeInTheDocument();
    expect(within(disclosure).getByText("dark")).toBeInTheDocument();
  });
});
