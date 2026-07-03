import { describe, expect, it } from "vitest";

import {
  BRAND_TOKEN_NAMES,
  formatColor,
  formatHex,
  RAMP_LABELS,
  RAMP_ROLES,
  type ColorFormat,
} from "@garden/oklch";

import { derivePalette } from "./derive";
import { DEFAULT_GAMUT, DEFAULT_RULES } from "./rules";
import { EXPORT_TABS, serializeExport } from "./exporters";

const set = derivePalette("#7c3aed", DEFAULT_RULES, DEFAULT_GAMUT).tokenSet;

/** Every `--name` the CSS export may legally reference: the semantic tokens + the ramp steps. */
const ALLOWED_PROPS = new Set<string>([
  ...BRAND_TOKEN_NAMES,
  ...RAMP_ROLES.flatMap((role) =>
    RAMP_LABELS.map((label) => `${role}-${label}`),
  ),
]);

describe("serializeExport — no drift from the derived palette", () => {
  it.each<ColorFormat>(["oklch", "hex", "rgb"])(
    "CSS export bakes the exact derived accent value (%s)",
    (format) => {
      const css = serializeExport("css", set, format);
      const expected = `--accent: light-dark(${formatColor(set.tokens.accent.light, format)}, ${formatColor(set.tokens.accent.dark, format)});`;
      expect(css).toContain(expected);
    },
  );

  it("the CSS export invents no names — only engine token + ramp properties", () => {
    const css = serializeExport("css", set, "oklch");
    const props = [...css.matchAll(/(--[a-z0-9-]+):/g)].map((m) =>
      m[1].slice(2),
    );
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) {
      expect(ALLOWED_PROPS.has(prop)).toBe(true);
    }
  });

  it("Tailwind export bakes the derived accent under the --color namespace", () => {
    const tw = serializeExport("tailwind", set, "oklch");
    const expected = `--color-accent: light-dark(${formatColor(set.tokens.accent.light, "oklch")}, ${formatColor(set.tokens.accent.dark, "oklch")});`;
    expect(tw).toContain("@theme");
    expect(tw).toContain(expected);
  });

  it("JSON export carries the derived accent value per scheme", () => {
    const json = JSON.parse(serializeExport("json", set, "hex"));
    expect(json.light.semantic.accent.$value.hex).toBe(
      formatHex(set.tokens.accent.light),
    );
    expect(json.dark.semantic.accent.$value.hex).toBe(
      formatHex(set.tokens.accent.dark),
    );
  });

  it("the format switch changes the serialized values", () => {
    const oklch = serializeExport("css", set, "oklch");
    const hex = serializeExport("css", set, "hex");
    expect(oklch).not.toBe(hex);
    expect(hex).toContain("--accent: light-dark(#");
  });

  it("every tab produces a non-empty string", () => {
    for (const tab of EXPORT_TABS) {
      expect(serializeExport(tab.id, set, "oklch").length).toBeGreaterThan(0);
    }
  });
});
