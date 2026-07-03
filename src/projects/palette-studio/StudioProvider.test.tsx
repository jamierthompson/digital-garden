import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StudioProvider from "./StudioProvider";
import SeedSlot from "./slots/SeedSlot";
import RulesSlot from "./slots/RulesSlot";
import PrimitivesSlot from "./slots/PrimitivesSlot";
import TokensSlot from "./slots/TokensSlot";
import PreviewSlot from "./slots/PreviewSlot";
import ReceiptSlot from "./slots/ReceiptSlot";
import ExportSlot from "./slots/ExportSlot";

/**
 * The composed studio, as the entry page mounts it: the Provider frame with every slot —
 * in authored order — beneath it. In production the slots arrive as `liveEmbed`s
 * interleaved through server prose; state flows identically (context), so this is the
 * faithful jsdom composition.
 */
function renderStudio(slug = "demo") {
  return render(
    <StudioProvider slug={slug}>
      <SeedSlot />
      <RulesSlot />
      <PrimitivesSlot />
      <TokensSlot />
      <PreviewSlot />
      <ReceiptSlot />
      <ExportSlot />
    </StudioProvider>,
  );
}

/** Read the resolved value text of one semantic-token row in the token table. */
function tokenValue(name: string): string {
  const header = screen.getByRole("rowheader", { name: `--${name}` });
  const row = header.closest("tr");
  if (!row) throw new Error(`no row for --${name}`);
  return within(row).getByText(/oklch\(/).textContent ?? "";
}

const ALL_SLOTS = [
  ["seed", SeedSlot],
  ["rules", RulesSlot],
  ["primitives", PrimitivesSlot],
  ["tokens", TokensSlot],
  ["preview", PreviewSlot],
  ["receipt", ReceiptSlot],
  ["export", ExportSlot],
] as const;

describe("Palette Studio (Provider + slots)", () => {
  it("mounts with the default seed and a live parsed readout", () => {
    renderStudio();
    const input = screen.getByLabelText("Seed color") as HTMLInputElement;
    expect(input.value).toBe("oklch(0.66 0.2 350)");
    // The readout echoes the parsed seed (canonicalized by the engine parser). It's the
    // status region that carries an oklch() value (the other is the anchor receipt).
    const readout = screen
      .getAllByRole("status")
      .find((el) => /oklch\(/.test(el.textContent ?? ""));
    expect(readout).toBeDefined();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("re-derives across slots when a new seed is typed (shared state)", () => {
    renderStudio();
    const before = tokenValue("accent");
    // The input lives in the seed slot; the token table is a DIFFERENT slot — the change
    // must cross the provider, not component-local state.
    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#16a34a" },
    });
    expect(tokenValue("accent")).not.toBe(before);
  });

  it("signals an unparseable seed inline without crashing", () => {
    renderStudio();
    const input = screen.getByLabelText("Seed color");
    fireEvent.change(input, { target: { value: "definitely-not-a-color" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/can.t read that color/i)).toBeInTheDocument();
    // The palette still renders — a full token table survives a garbage seed.
    expect(screen.getByRole("rowheader", { name: "--accent" })).toBeVisible();
  });

  it("applies a preset chip's seed on click", () => {
    renderStudio();
    // Flamingo is the default, so it starts pressed.
    expect(screen.getByRole("button", { name: /Flamingo/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Fern/ }));
    expect(
      (screen.getByLabelText("Seed color") as HTMLInputElement).value,
    ).toBe("#16a34a");
    expect(screen.getByRole("button", { name: /Fern/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("routes each rule choice into a re-derivation and shows its consequence", () => {
    renderStudio();
    const before = tokenValue("text");
    // Distribution → the interior steps reshape, so a bound token can move.
    fireEvent.click(screen.getByRole("radio", { name: "Punchy" }));
    expect(screen.getByRole("radio", { name: "Punchy" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText(/steep mid-section/i)).toBeInTheDocument();
    expect(tokenValue("text")).not.toBe(before);
  });

  it("toggles tinted neutrals and reflects the change in the neutral ramp", () => {
    renderStudio();
    const before = tokenValue("surface");
    const toggle = screen.getByRole("switch", { name: "Tinted neutrals" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/achromatic greys/i)).toBeInTheDocument();
    // Surfaces come off the neutral ramp — dropping the tint changes their value.
    expect(tokenValue("surface")).not.toBe(before);
  });

  it("switches the displayed scheme without re-deriving from scratch", () => {
    renderStudio();
    expect(screen.getByText(/light scheme/i)).toBeInTheDocument();
    const lightBg = tokenValue("bg");
    fireEvent.click(screen.getByRole("radio", { name: "dark" }));
    expect(screen.getByText(/dark scheme/i)).toBeInTheDocument();
    // Dark bg differs from light bg — both schemes are always derived.
    expect(tokenValue("bg")).not.toBe(lightBg);
  });

  it("exposes each rule as a labeled radio group with its current selection", () => {
    renderStudio();
    for (const name of ["Distribution", "Chroma", "Hue drift", "Gamut"]) {
      expect(screen.getByRole("radiogroup", { name })).toBeInTheDocument();
    }
    // The accessible structure Radix's roving keyboard nav rides on: every option is a radio,
    // and the current choice is reflected via aria-checked (live arrow-key drive is verified
    // in the browser QA pass — jsdom can't simulate Radix's focus mechanics).
    const distribution = screen.getByRole("radiogroup", {
      name: "Distribution",
    });
    const radios = within(distribution).getAllByRole("radio");
    expect(radios).toHaveLength(5);
    const checked = radios.filter(
      (r) => r.getAttribute("aria-checked") === "true",
    );
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName("Tailwind");
  });

  it("renders a live preview and a contrast receipt for BOTH schemes", () => {
    renderStudio();
    for (const name of [
      "light preview",
      "dark preview",
      "light contrast receipt",
      "dark contrast receipt",
    ]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    // The receipt is the guarantee: every measured pair passes, in both schemes.
    for (const name of ["light contrast receipt", "dark contrast receipt"]) {
      const card = screen.getByRole("group", { name });
      const marks = within(card).getAllByRole("img");
      expect(marks.length).toBeGreaterThan(0);
      for (const mark of marks) {
        expect(mark).toHaveAccessibleName("passes");
      }
    }
  });

  it("re-measures the receipt when the seed changes", () => {
    renderStudio();
    const receipt = () =>
      screen.getByRole("group", { name: "light contrast receipt" }).textContent;
    const before = receipt();
    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#06b6d4" },
    });
    expect(receipt()).not.toBe(before);
  });

  it("exports the live palette and re-serializes when the seed changes", () => {
    renderStudio();
    const exportRegion = screen.getByRole("region", { name: "Export" });
    const before = within(exportRegion).getByRole("tabpanel").textContent;
    expect(before).toContain(":root");
    expect(before).toContain("--accent");
    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#06b6d4" },
    });
    expect(within(exportRegion).getByRole("tabpanel").textContent).not.toBe(
      before,
    );
  });

  it("namespaces control ids by slug so two mounts don't collide", () => {
    const { unmount } = render(
      <StudioProvider slug="alpha">
        <SeedSlot />
      </StudioProvider>,
    );
    expect(screen.getByLabelText("Seed color").id).toBe("ps-alpha-seed");
    unmount();
    render(
      <StudioProvider slug="beta">
        <SeedSlot />
      </StudioProvider>,
    );
    expect(screen.getByLabelText("Seed color").id).toBe("ps-beta-seed");
  });

  it("every slot degrades to a visible placeholder when mounted without the frame", () => {
    // A liveEmbed can be authored into ANY entry's body — a slot outside the studio entry
    // must say so, not crash the essay.
    for (const [, Slot] of ALL_SLOTS) {
      const { container, unmount } = render(<Slot />);
      expect(
        within(container as HTMLElement).getByRole("note"),
      ).toHaveTextContent(/no studio frame/i);
      unmount();
    }
  });
});
