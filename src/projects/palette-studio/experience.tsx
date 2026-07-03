"use client";

// The interactive Palette Studio. The client boundary lives at THIS leaf so the route and the
// surrounding editorial chrome stay server-rendered. All state is here; the pure headless core
// (derive.ts) re-runs the frozen engine on every change and the presentational children paint
// the result. The Studio's own chrome themes off the ambient ProjectScope tokens; the palette
// it GENERATES appears only as data — swatches, the token table, and (slices 3–4) a scoped
// preview + export.

import { useMemo, useState } from "react";

import { RadioGroup } from "radix-ui";
import type { Gamut, Scheme } from "@garden/oklch";

import type { ExperienceProps } from "@/projects/types";

import { derivePalette, describeAnchor, parseSeed } from "./derive";
import { DEFAULT_GAMUT, DEFAULT_RULES, type StudioRules } from "./rules";
import { DEFAULT_SEED } from "./presets";
import PrimitivesBoard from "./PrimitivesBoard";
import RulesRail from "./RulesRail";
import SeedRow from "./SeedRow";
import TokenTable from "./TokenTable";
import styles from "./experience.module.css";

const SCHEMES: readonly Scheme[] = ["light", "dark"];

export default function Experience({
  slug,
}: ExperienceProps): React.ReactElement {
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [rules, setRules] = useState<StudioRules>(DEFAULT_RULES);
  const [gamut, setGamut] = useState<Gamut>(DEFAULT_GAMUT);
  const [scheme, setScheme] = useState<Scheme>("light");

  const parsed = useMemo(() => parseSeed(seed), [seed]);
  // The single engine run per state change — kept out of render churn (a scheme toggle
  // must NOT re-derive). #41 will memoize the engine itself; this is just the idiomatic guard.
  const palette = useMemo(
    () => derivePalette(seed, rules, gamut),
    [seed, rules, gamut],
  );
  const view = scheme === "light" ? palette.light : palette.dark;

  // Namespace every minted id by the route slug: Cache Components can keep several `/[slug]`
  // routes mounted at once (React <Activity>), so a hardcoded id would collide across them.
  const idPrefix = `ps-${slug}`;

  const patchRules = (patch: Partial<StudioRules>): void =>
    setRules((prev) => ({ ...prev, ...patch }));

  return (
    <section className={styles.studio} aria-label="Palette Studio">
      <header className={styles.intro}>
        <h2 className={styles.heading}>Palette Studio</h2>
        <p className={styles.tagline}>
          One seed in — a complete, contrast-solved palette out. The math makes
          it impossible to ship a color-failing combination.
        </p>
      </header>

      <SeedRow
        idPrefix={idPrefix}
        seed={seed}
        parsed={parsed}
        onSeedChange={setSeed}
      />

      <div className={styles.body}>
        <RulesRail
          idPrefix={idPrefix}
          rules={rules}
          gamut={gamut}
          onRulesChange={patchRules}
          onGamutChange={setGamut}
        />

        <div className={styles.canvas}>
          <div className={styles.canvasHead}>
            <p className={styles.anchor} role="status" aria-live="polite">
              <span className={styles.anchorKicker}>Anchor</span>
              {describeAnchor(palette)}
            </p>
            <RadioGroup.Root
              className={styles.schemeToggle}
              aria-label="Displayed scheme"
              value={scheme}
              onValueChange={(v) => setScheme(v as Scheme)}
              orientation="horizontal"
            >
              {SCHEMES.map((s) => (
                <RadioGroup.Item
                  key={s}
                  className={styles.schemePill}
                  value={s}
                >
                  {s}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </div>

          <section className={styles.panel} aria-label="Primitive ramps">
            <h3 className={styles.panelTitle}>Primitives</h3>
            <PrimitivesBoard ramps={view.ramps} />
          </section>

          <section className={styles.panel} aria-label="Semantic tokens">
            <h3 className={styles.panelTitle}>Semantic tokens</h3>
            <TokenTable rows={palette.rows} scheme={scheme} />
          </section>
        </div>
      </div>
    </section>
  );
}
