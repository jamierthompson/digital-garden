/**
 * Visual contrast harness — the engine's real exit criterion.
 *
 * Proves PALETTE QUALITY, not just determinism: for 5 hue-spanning theme colors (incl.
 * the yellow & cyan stressers), in BOTH schemes, every text-on-surface and
 * accent-foreground pair clears its APCA Lc + WCAG target AFTER gamut mapping. Assert the
 * MEASURED number, never a CSS snapshot (testing.md). The companion `swatches.html`
 * artifact (regenerated below) is the eyeball check; run instructions in README.md.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { apcaLc, contrastWCAG } from "../contrast";
import { inGamut } from "../gamut";
import { resolveTheme } from "../palette";
import type { OkLCH, Scheme } from "../types";
import { THEME_SAMPLES, renderSwatchDocument } from "./swatches";

const SCHEMES: Scheme[] = ["light", "dark"];

interface PairCheck {
  label: string;
  fg: (t: ReturnType<typeof resolveTheme>["tokens"]) => OkLCH;
  bg: (t: ReturnType<typeof resolveTheme>["tokens"]) => OkLCH;
  wcag: number;
  apca: number;
}

// The pairs the engine guarantees. Text foregrounds are solved against the worst-case
// surface (surface-elevated), so each also clears on background and surface — both asserted below.
const CHECKS: PairCheck[] = [
  {
    label: "foreground / surface-elevated",
    fg: (t) => t.foreground,
    bg: (t) => t["surface-elevated"],
    wcag: 4.5,
    apca: 75,
  },
  {
    label: "foreground / surface",
    fg: (t) => t.foreground,
    bg: (t) => t.surface,
    wcag: 4.5,
    apca: 75,
  },
  {
    label: "foreground / background",
    fg: (t) => t.foreground,
    bg: (t) => t.background,
    wcag: 4.5,
    apca: 75,
  },
  {
    label: "muted / surface-elevated",
    fg: (t) => t["muted-foreground"],
    bg: (t) => t["surface-elevated"],
    wcag: 4.5,
    apca: 60,
  },
  {
    label: "accent-text / surface-elevated",
    fg: (t) => t["accent-text"],
    bg: (t) => t["surface-elevated"],
    wcag: 4.5,
    apca: 60,
  },
  {
    label: "accent-foreground / accent",
    fg: (t) => t["accent-foreground"],
    bg: (t) => t.accent,
    wcag: 4.5,
    apca: 60,
  },
  {
    label: "accent / surface-elevated",
    fg: (t) => t.accent,
    bg: (t) => t["surface-elevated"],
    wcag: 3,
    apca: 45,
  },
  {
    label: "border / surface-elevated",
    fg: (t) => t.border,
    bg: (t) => t["surface-elevated"],
    wcag: 3,
    // The engine's own CONTRAST_TARGETS.border is Lc 30 (palette.ts) — assert it delivers that.
    apca: 30,
  },
  {
    label: "ring / surface-elevated",
    fg: (t) => t["ring"],
    bg: (t) => t["surface-elevated"],
    wcag: 3,
    apca: 45,
  },
];

describe("visual contrast harness", () => {
  for (const sample of THEME_SAMPLES) {
    for (const scheme of SCHEMES) {
      describe(`${sample.name} — ${scheme}`, () => {
        const { tokens } = resolveTheme(sample.themeColor, scheme);

        it.each(CHECKS)("$label meets its contrast target", (check) => {
          const fg = check.fg(tokens);
          const bg = check.bg(tokens);
          expect(inGamut(fg, "srgb")).toBe(true);
          expect(inGamut(bg, "srgb")).toBe(true);
          expect(contrastWCAG(fg, bg)).toBeGreaterThanOrEqual(check.wcag);
          if (check.apca > 0) {
            expect(apcaLc(fg, bg)).toBeGreaterThanOrEqual(check.apca);
          }
        });
      });
    }
  }

  it("regenerates the eyeball swatch artifact (open swatches.html in a browser)", (ctx) => {
    const html = renderSwatchDocument();
    expect(html).toContain("<!doctype html>");
    // This suite runs under BOTH the `node` and `jsdom` Vitest projects (the
    // isomorphism guard — see vitest.config.ts). The assertions belong in both;
    // the file WRITE does not — two projects would write identical bytes twice.
    // Scope the write to the `node` project only: it's where the engine's pure
    // output lives most naturally, and node's `fs` avoids jsdom's URL-global quirk
    // (see fileURLToPath note below). `task.file.projectName` is Vitest's public
    // per-entry name; under jsdom this returns early and only asserts.
    if (ctx.task.file.projectName !== "node") return;
    // Deterministic engine → identical bytes on every run, so this never dirties git
    // unless the engine's output actually changed (which is meaningful signal).
    // fileURLToPath(string) avoids the URL global, whose jsdom variant Node's fs rejects.
    const outPath = fileURLToPath(import.meta.url).replace(
      /harness\.test\.ts$/,
      "swatches.html",
    );
    writeFileSync(outPath, html, "utf8");
  });
});
