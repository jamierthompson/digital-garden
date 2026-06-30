/**
 * Color-space conversions and string parsing/formatting.
 *
 * Hand-rolled (no dependency) to stay provably isomorphic and dependency-light.
 * OKLab matrices are Björn Ottosson's reference values
 * (https://bottosson.github.io/posts/oklab/); the sRGB⇄XYZ⇄Display-P3 matrices are
 * the CSS Color 4 reference values (https://www.w3.org/TR/css-color-4/#color-conversion-code).
 */

import type { Gamut, OkLab, OkLCH, RGB } from "./types";

/** Gamma-encoded sRGB channel → linear-light. Also the Display-P3 transfer fn. */
export function srgbToLinear(c: number): number {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return abs <= 0.04045 ? c / 12.92 : sign * ((abs + 0.055) / 1.055) ** 2.4;
}

/** Linear-light channel → gamma-encoded sRGB. */
export function linearToSrgb(c: number): number {
  const sign = c < 0 ? -1 : 1;
  const abs = Math.abs(c);
  return abs <= 0.0031308
    ? c * 12.92
    : sign * (1.055 * abs ** (1 / 2.4) - 0.055);
}

/** Linear-light sRGB → OKLab. */
export function linearSrgbToOklab({ r, g, b }: RGB): OkLab {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** OKLab → linear-light sRGB (may contain out-of-[0,1] / negative channels). */
export function oklabToLinearSrgb({ L, a, b }: OkLab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/** OKLab → OKLCH (rectangular → cylindrical). */
export function oklabToOklch({ L, a, b }: OkLab): OkLCH {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

/** OKLCH → OKLab (cylindrical → rectangular). */
export function oklchToOklab({ L, C, H }: OkLCH): OkLab {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

/** OKLCH → gamma-encoded sRGB (channels may fall outside [0,1] if out of gamut). */
export function oklchToSrgb(color: OkLCH): RGB {
  const lin = oklabToLinearSrgb(oklchToOklab(color));
  return {
    r: linearToSrgb(lin.r),
    g: linearToSrgb(lin.g),
    b: linearToSrgb(lin.b),
  };
}

/** Gamma-encoded sRGB → OKLCH. */
export function srgbToOklch({ r, g, b }: RGB): OkLCH {
  const lin = { r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) };
  return oklabToOklch(linearSrgbToOklab(lin));
}

/**
 * OKLCH → linear-light Display-P3. Path: OKLab → linear sRGB → XYZ(D65) → linear P3.
 * Reference matrices from CSS Color 4.
 */
export function oklchToLinearP3(color: OkLCH): RGB {
  const { r, g, b } = oklabToLinearSrgb(oklchToOklab(color));

  // linear sRGB → XYZ (D65)
  const x = 0.4123907993 * r + 0.3575843394 * g + 0.1804807884 * b;
  const y = 0.2126390059 * r + 0.7151686788 * g + 0.0721923154 * b;
  const z = 0.0193308187 * r + 0.1191947798 * g + 0.9505321522 * b;

  // XYZ (D65) → linear Display-P3
  return {
    r: 2.4934969119 * x - 0.9313836179 * y - 0.4027107845 * z,
    g: -0.8294889696 * x + 1.7626640603 * y + 0.0236246858 * z,
    b: 0.0358458302 * x - 0.0761723893 * y + 0.956884524 * z,
  };
}

/** Linear-light RGB for the requested gamut (channels may be out of [0,1]). */
export function oklchToLinearRgb(color: OkLCH, gamut: Gamut): RGB {
  return gamut === "p3"
    ? oklchToLinearP3(color)
    : oklabToLinearSrgb(oklchToOklab(color));
}

const HEX3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/i;
const OKLCH_FN = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i;

function channel(token: string): number {
  // rgb() channels are 0–255 or 0–100% → normalize to 0–1.
  if (token.endsWith("%")) return clamp01(parseFloat(token) / 100);
  return clamp01(parseFloat(token) / 255);
}

/**
 * Parse a color string into OKLCH. Supports `#rgb`, `#rrggbb(aa)`, `rgb()/rgba()`,
 * and `oklch(L C H)` (L as 0–1 or `%`). Returns `null` on anything it can't parse —
 * the caller turns that into the safe fallback palette. NEVER throws.
 */
export function parseColor(input: unknown): OkLCH | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (raw === "") return null;

  const hex3 = raw.match(HEX3);
  if (hex3) {
    const r = parseInt(hex3[1] + hex3[1], 16) / 255;
    const g = parseInt(hex3[2] + hex3[2], 16) / 255;
    const b = parseInt(hex3[3] + hex3[3], 16) / 255;
    return finite(srgbToOklch({ r, g, b }));
  }

  const hex6 = raw.match(HEX6);
  if (hex6) {
    const r = parseInt(hex6[1], 16) / 255;
    const g = parseInt(hex6[2], 16) / 255;
    const b = parseInt(hex6[3], 16) / 255;
    return finite(srgbToOklch({ r, g, b }));
  }

  const rgb = raw.match(RGB_FN);
  if (rgb) {
    return finite(
      srgbToOklch({
        r: channel(rgb[1]),
        g: channel(rgb[2]),
        b: channel(rgb[3]),
      }),
    );
  }

  const oklch = raw.match(OKLCH_FN);
  if (oklch) {
    const L = oklch[1].endsWith("%")
      ? parseFloat(oklch[1]) / 100
      : parseFloat(oklch[1]);
    const C = parseFloat(oklch[2]);
    const H = parseFloat(oklch[3]);
    return finite({
      L: clamp01(L),
      C: Math.max(0, C),
      H: ((H % 360) + 360) % 360,
    });
  }

  return null;
}

/** Guard against NaN/Infinity sneaking through arithmetic — treat as unparseable. */
function finite(color: OkLCH): OkLCH | null {
  return Number.isFinite(color.L) &&
    Number.isFinite(color.C) &&
    Number.isFinite(color.H)
    ? color
    : null;
}

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Trim a number to `places` decimals without trailing zeros (for compact CSS). */
function fmt(n: number, places: number): string {
  return parseFloat(n.toFixed(places)).toString();
}

/** Format an OKLCH as a literal `oklch(L C H)` string for baking into CSS. */
export function formatOklch({ L, C, H }: OkLCH): string {
  return `oklch(${fmt(L, 4)} ${fmt(C, 4)} ${fmt(H, 2)})`;
}
