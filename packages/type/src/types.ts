// The type engine's public vocabulary. The engine deals in SCALE STEPS, not semantic roles:
// it emits a Radix-style numeric ramp (`--type-size-1 … --type-size-N`, 1 = smallest) of fluid,
// zoom-capped sizes. Semantic ROLES (heading/body/…) are the APP's concern — the app binds a
// role to a step (`--type-heading-size: var(--type-size-8)`), so it can add/rename/drop roles
// without touching the engine, and a demo can ignore roles and reach any step directly.

/**
 * The scale inputs. Utopia's two-viewport method: the ramp is computed at a small viewport and a
 * large one, then each step is interpolated between the two with a fluid `clamp()`. A tighter
 * `minRatio` keeps deep steps from overflowing a phone; a wider `maxRatio` gives editorial drama
 * on a large screen. Every value is a live-tunable knob — none is load-bearing except the zoom
 * cap, which is enforced downstream regardless of what is set here.
 */
export interface ScaleConfig {
  /** Base size (rem) at the small viewport — the ramp's anchor (the step at ratio⁰) at `minVw`. */
  readonly baseMinRem: number;
  /** Base size (rem) at the large viewport — the anchor at `maxVw`. Fluid body. */
  readonly baseMaxRem: number;
  /** Modular ratio applied at the small viewport (tighter reads calmer/denser). */
  readonly minRatio: number;
  /** Modular ratio applied at the large viewport (wider reads more dramatic). */
  readonly maxRatio: number;
  /** Small viewport width (px) the small end is measured at. */
  readonly minVw: number;
  /** Large viewport width (px) the large end is measured at. */
  readonly maxVw: number;
  /** How many steps the ramp has — emitted as `--type-size-1 … --type-size-<stepCount>`. */
  readonly stepCount: number;
  /**
   * The 1-based index that sits at ratio⁰ (the base/body size). Steps below it descend by the
   * ratio (captions), steps above climb (headings/display). Lets the base land mid-ramp so there
   * is room below body without negative token names.
   */
  readonly baseIndex: number;
}

/**
 * One step's solved size. `clamp` is the ready-to-emit CSS value; `minRem`/`maxRem` are the
 * clamp's floor and ceiling in rem (floor ≤ ceiling always, even for a sub-base step whose
 * desktop size is the smaller of the two). `zoomCapped` flags a step whose ceiling was pulled
 * down to satisfy the WCAG 1.4.4 zoom cap — the type analog of the color engine's out-of-gamut
 * flag: solved and clamped, never eyeballed.
 */
export interface FluidStep {
  readonly minRem: number;
  readonly maxRem: number;
  readonly clamp: string;
  readonly zoomCapped: boolean;
}

/** The solved ramp: one `FluidStep` per step in `--type-size-1 … N` order, plus receipts. */
export interface TypeScale {
  /** Steps in emission order — `steps[0]` is `--type-size-1`, `steps[N-1]` is `--type-size-N`. */
  readonly steps: readonly FluidStep[];
  readonly meta: TypeScaleMeta;
}

export interface TypeScaleMeta {
  /** Echo of the config actually used (after fallback substitution for bad input). */
  readonly config: ScaleConfig;
  /** True when any field was invalid and the whole config fell back to the default. */
  readonly isFallback: boolean;
  /** 1-based step indices whose ceiling the zoom cap pulled down — for a studio/QA readout. */
  readonly zoomCappedSteps: readonly number[];
}
