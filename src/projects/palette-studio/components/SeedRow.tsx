// The seed row — a labeled text input (parsed on every change), a live readout of the
// parsed OKLCH (or a visible inline "unparseable" signal when the seed can't be read), and
// the preset starter chips. The input accepts hex / rgb() / oklch(); the engine's own parser
// decides validity, so the readout can never disagree with the derived palette.

import { formatOklch } from "@garden/oklch";

import ChipGroup from "@/components/ui/ChipGroup";
import Kicker from "@/components/ui/Kicker";
import TextInput from "@/components/ui/TextInput";

import type { ParsedSeed } from "../core/derive";
import { PRESETS } from "../core/presets";
import styles from "./SeedRow.module.css";

interface SeedRowProps {
  /** Slug-derived id namespace so the input/readout ids don't collide across mounts. */
  readonly idPrefix: string;
  readonly seed: string;
  readonly parsed: ParsedSeed;
  readonly onSeedChange: (seed: string) => void;
}

export default function SeedRow({
  idPrefix,
  seed,
  parsed,
  onSeedChange,
}: SeedRowProps): React.ReactElement {
  const inputId = `${idPrefix}-seed`;
  const readoutId = `${idPrefix}-seed-readout`;
  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <Kicker htmlFor={inputId}>Seed color</Kicker>
        <div className={styles.inputWrap}>
          <span
            className={styles.swatch}
            style={
              parsed.oklch
                ? { background: formatOklch(parsed.oklch) }
                : undefined
            }
            data-empty={parsed.oklch ? undefined : ""}
            aria-hidden="true"
          />
          <TextInput
            mono
            id={inputId}
            value={seed}
            onChange={(e) => onSeedChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-invalid={parsed.isFallback}
            aria-describedby={readoutId}
            placeholder="#3b82f6, rgb(…), oklch(…)"
          />
        </div>
        <p
          id={readoutId}
          className={styles.readout}
          role="status"
          aria-live="polite"
        >
          {parsed.oklch ? (
            formatOklch(parsed.oklch)
          ) : (
            <span className={styles.invalid}>
              can’t read that color — showing a safe fallback
            </span>
          )}
        </p>
      </div>

      <div className={styles.presets}>
        <Kicker>Starters</Kicker>
        <ChipGroup
          label="Preset seeds"
          value={PRESETS.some((p) => p.seed === seed) ? seed : ""}
          onValueChange={(picked) => {
            // "" = Radix single-type deselect (re-clicking the active preset) — a no-op
            // here; the seed keeps its value.
            if (picked) onSeedChange(picked);
          }}
          options={PRESETS.map((p) => ({
            value: p.seed,
            label: p.name,
            swatch: p.seed,
          }))}
        />
      </div>
    </div>
  );
}
