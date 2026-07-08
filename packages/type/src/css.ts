// CSS serialization — the engine's output side. Each solved step becomes a `--type-size-<n>`
// custom property (Radix-style numeric ramp, 1 = smallest) whose value is the fluid `clamp()`.
// These are the FOUNDATION scale tokens: a demo reads any step directly, and the app's semantic
// role bundles (`--type-<role>-size`, app-owned) bind a role to one of them.

import type { TypeScale } from "./types";

/** The custom-property name for a 1-based step index. */
export function sizeVarName(index: number): string {
  return `--type-size-${index}`;
}

/**
 * The ramp as `[property, value]` pairs, in `--type-size-1 … N` order — the shape the app bakes
 * into `foundation.css` (and a guard test recomputes to catch drift, mirroring the color tokens).
 */
export function typeScaleToDeclarations(
  scale: TypeScale,
): Array<[string, string]> {
  return scale.steps.map((step, i) => [sizeVarName(i + 1), step.clamp]);
}

/**
 * The ramp as a CSS text block of declarations (one per line, indented for a `:root { … }` host).
 * Byte-for-byte what a generator would paste under the scale comment in `foundation.css`.
 */
export function typeScaleToCss(scale: TypeScale, indent = "    "): string {
  return typeScaleToDeclarations(scale)
    .map(([prop, value]) => `${indent}${prop}: ${value};`)
    .join("\n");
}
