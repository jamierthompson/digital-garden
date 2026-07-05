import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudioProvider from "./StudioProvider";
import SeedSlot from "./slots/SeedSlot";
import RulesSlot from "./slots/RulesSlot";
import TokensSlot from "./slots/TokensSlot";
import PreviewSlot from "./slots/PreviewSlot";
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
      <TokensSlot />
      <PreviewSlot />
      <ExportSlot />
    </StudioProvider>,
  );
}

/** Read the resolved value text off one token's swatch card (the active-scheme face). The
 *  MiniRamp readout also prints an oklch() value, so target the face value cell specifically —
 *  the only element whose text STARTS with "oklch(". */
function tokenValue(name: string): string {
  const heading = screen.getByRole("heading", { name: `--${name}` });
  const card = heading.closest("li");
  if (!card) throw new Error(`no card for --${name}`);
  const value = within(card)
    .getAllByText(/oklch\(/)
    .find((el) => (el.textContent ?? "").startsWith("oklch("));
  if (!value) throw new Error(`no face value for --${name}`);
  return value.textContent ?? "";
}

const ALL_SLOTS = [
  ["seed", SeedSlot],
  ["rules", RulesSlot],
  ["tokens", TokensSlot],
  ["preview", PreviewSlot],
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
    // The input lives in the seed slot; the card grid is a DIFFERENT slot — the change
    // must cross the provider, not component-local state.
    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#16a34a" },
    });
    expect(tokenValue("accent")).not.toBe(before);
  });

  it("re-binds every slot's own chrome to the CURRENT seed (self-demonstrating tool)", () => {
    // Owner design call (2026-07-03): the slots' pills/switch/tabs repaint live with the
    // palette they generate — the provider's slotStyle re-binds the semantic tokens on
    // each Panel. The prose around the slots stays editorial; this only themes inside.
    renderStudio();
    const rulesPanel = screen.getByRole("region", { name: "Rules" });
    const before = rulesPanel.style.getPropertyValue("--accent");
    expect(before).not.toBe("");
    fireEvent.change(screen.getByLabelText("Seed color"), {
      target: { value: "#16a34a" },
    });
    const after = rulesPanel.style.getPropertyValue("--accent");
    expect(after).not.toBe(before);
    // Every slot panel carries the SAME live binding.
    for (const name of ["Seed", "Swatch cards", "Live preview", "Export"]) {
      expect(
        screen.getByRole("region", { name }).style.getPropertyValue("--accent"),
      ).toBe(after);
    }
  });

  it("signals an unparseable seed inline without crashing", () => {
    renderStudio();
    const input = screen.getByLabelText("Seed color");
    fireEvent.change(input, { target: { value: "definitely-not-a-color" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/can.t read that color/i)).toBeInTheDocument();
    // The palette still renders — the full card grid survives a garbage seed.
    expect(screen.getByRole("heading", { name: "--accent" })).toBeVisible();
  });

  it("applies a preset chip's seed on click", () => {
    renderStudio();
    // Flamingo is the default, so it starts checked (Radix single-type = radio chips).
    expect(screen.getByRole("radio", { name: /Flamingo/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("radio", { name: /Fern/ }));
    expect(
      (screen.getByLabelText("Seed color") as HTMLInputElement).value,
    ).toBe("#16a34a");
    expect(screen.getByRole("radio", { name: /Fern/ })).toHaveAttribute(
      "aria-checked",
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

  it("follows the viewer's preferred color scheme — no page-local toggle (#133)", () => {
    // The scheme is observed through the derived tokens (the ambient "showing the X scheme"
    // caption was removed, #owner): the setup stub's matchMedia never matches, so the default
    // render reads as light…
    renderStudio();
    const lightBg = tokenValue("bg");
    cleanup();
    // …and a dark-preferring viewer gets the dark view of the SAME derivation.
    const mql = {
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    try {
      renderStudio();
      // Dark bg differs from light bg — both schemes are always derived, and the studio paints
      // the viewer's (no page-local toggle).
      expect(tokenValue("bg")).not.toBe(lightBg);
    } finally {
      vi.unstubAllGlobals();
    }
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

  it("renders one scheme-neutral live preview", () => {
    renderStudio();
    // The preview is a SINGLE scheme-neutral group — the specimens inherit the slot's
    // light-dark() palette and paint the viewer's scheme via CSS (no scheme in the name, no
    // light-first lie).
    expect(
      screen.getByRole("group", { name: "palette preview" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /light preview|dark preview/ }),
    ).not.toBeInTheDocument();
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

// Adversarial QA (QA-S13, ported to the #131 composition) for the Studio UI — the edges
// the author's suite optimised past: two instances mounted AT ONCE (Cache Components /
// <Activity> keeps several `/[slug]` routes alive), rapid chip→type→chip input churn,
// aria-invalid honesty round-tripped through the real component, and scheme-toggle
// consistency between the table caption and the toggle — now ACROSS slots, not within
// one component tree.

function studio(slug: string) {
  return (
    <StudioProvider slug={slug}>
      <SeedSlot />
      <RulesSlot />
      <TokensSlot />
      <PreviewSlot />
      <ExportSlot />
    </StudioProvider>
  );
}

describe("QA-S13 · Studio UI under adversarial interaction", () => {
  it(
    "two instances mounted simultaneously mint NO duplicate element ids",
    { timeout: 60000 },
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
    { timeout: 60000 },
    () => {
      render(studio("demo"));
      const input = () =>
        screen.getByLabelText("Seed color") as HTMLInputElement;

      fireEvent.click(screen.getByRole("radio", { name: /Solar/ }));
      expect(input().value).toBe("#eab308");
      expect(input()).toHaveAttribute("aria-invalid", "false");

      fireEvent.change(input(), { target: { value: "###" } });
      expect(input()).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText(/can.t read that color/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("radio", { name: /Lagoon/ }));
      expect(input().value).toBe("#06b6d4");
      expect(input()).toHaveAttribute("aria-invalid", "false");
      // The unparseable signal is gone once a valid seed is applied.
      expect(
        screen.queryByText(/can.t read that color/i),
      ).not.toBeInTheDocument();

      fireEvent.change(input(), { target: { value: "" } });
      expect(input()).toHaveAttribute("aria-invalid", "true");
      // Even empty, the card grid is intact — the tool never blanks out.
      expect(screen.getByRole("heading", { name: "--accent" })).toBeVisible();
    },
  );

  it(
    "aria-invalid tracks the SAME parser the palette derives from (no lying input)",
    { timeout: 60000 },
    () => {
      render(studio("demo"));
      const input = screen.getByLabelText("Seed color") as HTMLInputElement;
      // hsl is normalized to rgb ahead of the engine parser (QA-131 D3) — valid now.
      fireEvent.change(input, { target: { value: "hsl(210 50% 50%)" } });
      expect(input).toHaveAttribute("aria-invalid", "false");
      // A space the engine genuinely rejects still reads invalid.
      fireEvent.change(input, { target: { value: "lab(52% 40 59)" } });
      expect(input).toHaveAttribute("aria-invalid", "true");
      // A wide-gamut oklch is accepted.
      fireEvent.change(input, { target: { value: "oklch(0.7 0.15 200)" } });
      expect(input).toHaveAttribute("aria-invalid", "false");
    },
  );

  it(
    "single-scheme slots follow the viewer's scheme — no page-local toggle",
    { timeout: 60000 },
    () => {
      render(studio("demo"));
      // No page-local scheme toggle by design — the toggle is site-wide chrome (#133).
      expect(
        screen.queryByRole("radio", { name: /^(light|dark)$/ }),
      ).not.toBeInTheDocument();
    },
  );
});

// The WASH × TOGGLE integration seam: the page's paint (every light-dark() token, the wash)
// follows the resolved root `color-scheme`, so the provider's displayed scheme must track the
// same signal — `src/lib/scheme.ts`'s `subscribe`/`getResolvedScheme` (the #162 override when
// set, else the OS preference) — or the receipts describe a scheme the viewer isn't painted
// under. Pins the contract that paint and readouts can never disagree.
describe("QA-FINAL · site-wide scheme override seam (#162)", () => {
  it(
    "shows the OVERRIDDEN scheme's view when the toggle override is set — not the OS scheme",
    { timeout: 60000 },
    () => {
      // The setup stub's matchMedia never matches: the OS reads light. With the #162
      // override persisted as dark, the displayed face must be the DARK derivation —
      // the values the viewer is actually painted under the override.
      localStorage.setItem("scheme", "dark");
      try {
        renderStudio();
        const overridden = tokenValue("bg");
        cleanup();
        localStorage.removeItem("scheme");
        renderStudio();
        const osLight = tokenValue("bg");
        // The overridden render must show the dark derivation, the clean render the
        // light one — identical faces would mean the provider ignored the override.
        expect(overridden).not.toBe(osLight);
      } finally {
        localStorage.removeItem("scheme");
      }
    },
  );
});
