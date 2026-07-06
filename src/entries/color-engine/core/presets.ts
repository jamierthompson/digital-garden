// Starter seeds for the Color Engine's preset chips — a hue-spanning set so a first-time visitor
// can see the engine solve very different colors in one click. Deliberately includes the
// engine's two known stressers (a yellow and a cyan), whose contrast behavior is the whole
// point of a per-hue solve; the harness (`packages/oklch/src/harness/`) seeds the same pair.

/** One preset chip: a short tasteful name + the seed it applies. */
export interface Preset {
  readonly name: string;
  readonly seed: string;
}

/** The preset roster. The first entry doubles as the Color Engine's default seed. */
export const PRESETS: readonly Preset[] = [
  { name: "Flamingo", seed: "oklch(0.66 0.2 350)" },
  { name: "Signal", seed: "#e11d48" },
  { name: "Solar", seed: "#eab308" }, // yellow stresser
  { name: "Fern", seed: "#16a34a" },
  { name: "Lagoon", seed: "#06b6d4" }, // cyan stresser
  { name: "Ultraviolet", seed: "#7c3aed" },
];

/** The seed the Color Engine opens on — the ambient entry brand, so it starts on "its own" palette. */
export const DEFAULT_SEED: string = PRESETS[0].seed;
