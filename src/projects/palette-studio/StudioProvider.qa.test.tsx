// Adversarial QA (QA-S13, ported to the #131 composition) for the Studio UI — the edges
// the author's suite optimised past: two instances mounted AT ONCE (Cache Components /
// <Activity> keeps several `/[slug]` routes alive), rapid chip→type→chip input churn,
// aria-invalid honesty round-tripped through the real component, and scheme-toggle
// consistency between the table caption and the toggle — now ACROSS slots, not within
// one component tree.

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

function studio(slug: string) {
  return (
    <StudioProvider slug={slug}>
      <SeedSlot />
      <RulesSlot />
      <PrimitivesSlot />
      <TokensSlot />
      <PreviewSlot />
      <ReceiptSlot />
      <ExportSlot />
    </StudioProvider>
  );
}

describe("QA-S13 · Studio UI under adversarial interaction", () => {
  it(
    "two instances mounted simultaneously mint NO duplicate element ids",
    { timeout: 30000 },
    () => {
      // The author's own test unmounts between renders; the real risk is two live routes at once.
      const { container } = render(
        <>
          {studio("alpha")}
          {studio("beta")}
        </>,
      );
      const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) dupes.add(id);
        seen.add(id);
      }
      expect(
        [...dupes],
        `duplicate ids across two mounts: ${[...dupes]}`,
      ).toEqual([]);
      // And each instance's seed input carries its own slug-namespaced id.
      expect(document.getElementById("ps-alpha-seed")).not.toBeNull();
      expect(document.getElementById("ps-beta-seed")).not.toBeNull();
    },
  );

  it(
    "survives a rapid chip → typed-garbage → chip → clear sequence, staying honest",
    { timeout: 30000 },
    () => {
      render(studio("demo"));
      const input = () =>
        screen.getByLabelText("Seed color") as HTMLInputElement;

      fireEvent.click(screen.getByRole("button", { name: /Solar/ }));
      expect(input().value).toBe("#eab308");
      expect(input()).toHaveAttribute("aria-invalid", "false");

      fireEvent.change(input(), { target: { value: "###" } });
      expect(input()).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText(/can.t read that color/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Lagoon/ }));
      expect(input().value).toBe("#06b6d4");
      expect(input()).toHaveAttribute("aria-invalid", "false");
      // The unparseable signal is gone once a valid seed is applied.
      expect(
        screen.queryByText(/can.t read that color/i),
      ).not.toBeInTheDocument();

      fireEvent.change(input(), { target: { value: "" } });
      expect(input()).toHaveAttribute("aria-invalid", "true");
      // Even empty, the token table is intact — the tool never blanks out.
      expect(screen.getByRole("rowheader", { name: "--accent" })).toBeVisible();
    },
  );

  it(
    "aria-invalid tracks the SAME parser the palette derives from (no lying input)",
    { timeout: 30000 },
    () => {
      render(studio("demo"));
      const input = screen.getByLabelText("Seed color") as HTMLInputElement;
      // A string the naive eye might think valid but the engine rejects (hsl unsupported).
      fireEvent.change(input, { target: { value: "hsl(210 50% 50%)" } });
      expect(input).toHaveAttribute("aria-invalid", "true");
      // A wide-gamut oklch is accepted.
      fireEvent.change(input, { target: { value: "oklch(0.7 0.15 200)" } });
      expect(input).toHaveAttribute("aria-invalid", "false");
    },
  );

  it(
    "single-scheme slots follow the viewer's scheme; the receipt always shows BOTH",
    { timeout: 30000 },
    () => {
      render(studio("demo"));
      // No page-local scheme toggle by design — the toggle is site-wide chrome (#133).
      expect(
        screen.queryByRole("radio", { name: /^(light|dark)$/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/Showing the light scheme/i)).toBeInTheDocument();
      // The receipt shows BOTH schemes irrespective of the viewer's scheme.
      expect(
        screen.getByRole("group", { name: "light contrast receipt" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("group", { name: "dark contrast receipt" }),
      ).toBeInTheDocument();
    },
  );

  it(
    "every rendered contrast mark reads as a pass for the default seed, both schemes",
    { timeout: 30000 },
    () => {
      render(studio("demo"));
      for (const name of ["light contrast receipt", "dark contrast receipt"]) {
        const card = screen.getByRole("group", { name });
        const marks = within(card).getAllByRole("img");
        expect(marks.length).toBeGreaterThan(0);
        for (const mark of marks) {
          expect(mark).toHaveAccessibleName("passes");
        }
      }
    },
  );
});
