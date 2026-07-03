// The export tab's data layer (#107) — pure. Serializes the SAME `TokenSet` the preview and
// receipt consume into a portable string, using ONLY the engine's serializers: the export can
// never invent a token name or a value the engine didn't emit, so it can't drift from what the
// Studio shows. The format switch drives the engine's `ColorFormat`.

import {
  tokenSetToCss,
  tokenSetToDesignTokens,
  tokenSetToTailwindTheme,
  type ColorFormat,
  type TokenSet,
} from "@garden/oklch";

/** The three export targets. */
export type ExportTabId = "css" | "tailwind" | "json";

/** One export target: its tab label, the download filename, and the file's MIME type. */
export interface ExportTab {
  readonly id: ExportTabId;
  readonly label: string;
  readonly filename: string;
  readonly mime: string;
}

export const EXPORT_TABS: readonly ExportTab[] = [
  {
    id: "css",
    label: "CSS variables",
    filename: "palette.css",
    mime: "text/css",
  },
  {
    id: "tailwind",
    label: "Tailwind theme",
    filename: "palette.theme.css",
    mime: "text/css",
  },
  {
    id: "json",
    label: "JSON tokens",
    filename: "palette.tokens.json",
    mime: "application/json",
  },
];

/** One color-value serialization the export switch offers — the engine's `ColorFormat`. */
export interface FormatOption {
  readonly value: ColorFormat;
  readonly label: string;
}

export const FORMAT_OPTIONS: readonly FormatOption[] = [
  { value: "oklch", label: "OKLCH" },
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
];

/**
 * Serialize a `TokenSet` for one export tab + color format. `css` uses the engine's scoped
 * `@layer brand` rule at `:root` (portable to paste anywhere); `tailwind` a v4 `@theme`
 * block; `json` the W3C-DTCG tree, pretty-printed. Pure — same inputs, same string.
 */
export function serializeExport(
  id: ExportTabId,
  set: TokenSet,
  format: ColorFormat,
): string {
  switch (id) {
    case "css":
      return tokenSetToCss(set, ":root", { format });
    case "tailwind":
      return tokenSetToTailwindTheme(set, { format });
    case "json":
      return JSON.stringify(tokenSetToDesignTokens(set, { format }), null, 2);
  }
}
