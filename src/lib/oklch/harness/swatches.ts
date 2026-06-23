/**
 * Pure generator for the visual contrast harness artifact [D17].
 *
 * Builds a self-contained HTML document of swatch cards — one row per brand color, a
 * light and a dark panel each — using the engine's BAKED `oklch()` literals so a real
 * browser paints exactly what the engine solved [D3]. Every text-on-surface and
 * on-brand pair is labeled with its MEASURED APCA Lc and WCAG ratio (assert the number,
 * don't snapshot the CSS — testing.md). Pure & isomorphic: no DOM, no Node, no I/O —
 * it returns a string; the test writes it to disk.
 */

import { apcaLc, contrastWCAG } from "../contrast";
import { formatOklch } from "../convert";
import { resolveTheme } from "../palette";
import type { OkLCH, Scheme, SchemeTokens } from "../types";

export interface BrandSample {
  name: string;
  brandColor: string;
}

/** The default hue-spanning set — includes the yellow & cyan stressers [D4]. */
export const BRAND_SAMPLES: readonly BrandSample[] = [
  { name: "Crimson", brandColor: "#e11d48" },
  { name: "Amber (yellow stresser)", brandColor: "#eab308" },
  { name: "Emerald", brandColor: "#16a34a" },
  { name: "Cyan (cyan stresser)", brandColor: "#06b6d4" },
  { name: "Violet", brandColor: "#7c3aed" },
];

function badge(label: string, lc: number, ratio: number): string {
  return `<span class="badge">${label}: Lc ${lc.toFixed(1)} · ${ratio.toFixed(2)}:1</span>`;
}

function ramp(tokens: SchemeTokens): string {
  // Eyeball strip: surfaces + key tokens laid out as bars.
  const stops: Array<[string, OkLCH]> = [
    ["bg", tokens.bg],
    ["surface", tokens.surface],
    ["surface-2", tokens["surface-2"]],
    ["border", tokens.border],
    ["accent", tokens.accent],
    ["accent-text", tokens["accent-text"]],
    ["text", tokens.text],
  ];
  return stops
    .map(
      ([n, c]) =>
        `<div class="stop" style="background:${formatOklch(c)}" title="${n}"></div>`,
    )
    .join("");
}

function panel(scheme: Scheme, sample: BrandSample): string {
  const { tokens } = resolveTheme(sample.brandColor, scheme);
  const surfaceBg = tokens["surface-2"]; // worst-case surface the engine solves against
  const css = (c: OkLCH): string => formatOklch(c);

  return `
  <div class="panel" style="color-scheme:${scheme}; background:${css(tokens.bg)}; color:${css(tokens.text)}">
    <div class="scheme-label">${scheme}</div>
    <div class="card" style="background:${css(tokens.surface)}; border:1px solid ${css(tokens.border)}">
      <h3 style="color:${css(tokens.text)}">Heading on surface ${badge("text/sfc2", apcaLc(tokens.text, surfaceBg), contrastWCAG(tokens.text, surfaceBg))}</h3>
      <p style="color:${css(tokens.text)}">Body text — the readable default. ${badge("text/bg", apcaLc(tokens.text, tokens.bg), contrastWCAG(tokens.text, tokens.bg))}</p>
      <p style="color:${css(tokens["text-muted"])}">Muted secondary text. ${badge("muted/sfc2", apcaLc(tokens["text-muted"], surfaceBg), contrastWCAG(tokens["text-muted"], surfaceBg))}</p>
      <p><a style="color:${css(tokens["accent-text"])}">An accent link</a> ${badge("link/sfc2", apcaLc(tokens["accent-text"], surfaceBg), contrastWCAG(tokens["accent-text"], surfaceBg))}</p>
      <button style="background:${css(tokens.accent)}; color:${css(tokens["on-accent"])}; border:none; padding:6px 12px; border-radius:6px">Accent button ${badge("on-accent", apcaLc(tokens["on-accent"], tokens.accent), contrastWCAG(tokens["on-accent"], tokens.accent))}</button>
      <div class="ring" style="outline:2px solid ${css(tokens["focus-ring"])}; outline-offset:2px">focus ring ${badge("ring/sfc2", apcaLc(tokens["focus-ring"], surfaceBg), contrastWCAG(tokens["focus-ring"], surfaceBg))}</div>
      <div class="ramp">${ramp(tokens)}</div>
    </div>
  </div>`;
}

function row(sample: BrandSample): string {
  return `
  <section class="row">
    <h2>${sample.name} <code>${sample.brandColor}</code></h2>
    <div class="panels">${panel("light", sample)}${panel("dark", sample)}</div>
  </section>`;
}

/** Render the full eyeball document for the given samples. Pure. */
export function renderSwatchDocument(
  samples: readonly BrandSample[] = BRAND_SAMPLES,
): string {
  const rows = samples.map(row).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OKLCH engine — contrast harness swatches</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #1c1c1c; color: #eee; }
  h1 { font-size: 20px; }
  .note { color: #aaa; max-width: 60ch; line-height: 1.5; }
  .row { margin: 28px 0; }
  .row > h2 { font-size: 16px; }
  .row code { color: #9cf; }
  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .panel { border-radius: 12px; padding: 16px; }
  .scheme-label { text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; opacity: 0.6; margin-bottom: 8px; }
  .card { border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .card h3 { margin: 0; font-size: 15px; }
  .card p { margin: 0; font-size: 14px; }
  .badge { display: inline-block; font-size: 10px; font-family: ui-monospace, monospace; opacity: 0.75; padding: 1px 5px; border: 1px solid currentColor; border-radius: 4px; margin-left: 4px; }
  .ring { font-size: 12px; padding: 4px 8px; width: fit-content; border-radius: 4px; }
  .ramp { display: flex; height: 28px; border-radius: 6px; overflow: hidden; }
  .stop { flex: 1; }
</style>
</head>
<body>
<h1>OKLCH engine — contrast harness</h1>
<p class="note">
  Each brand color, light &amp; dark, baked to literal <code>oklch()</code> by the engine
  (gamut-mapped before contrast math, contrast solved per scheme). Badges show MEASURED
  APCA Lc and WCAG ratio for each pair. Open in a browser to eyeball palette quality;
  the numbers are asserted by <code>harness.test.ts</code>.
</p>
${rows}
</body>
</html>
`;
}
