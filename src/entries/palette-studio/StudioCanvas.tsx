// The studio canvas (#154, #139) — the prose-less, Experience-centered composition. Every
// surface the studio has (the seed input, the rules, the swatch-card grid, the shared glossary,
// the export, and a reserved region for the future harmony group) is mounted ONCE in a single
// top-level CSS grid whose `grid-template-areas` are NAMED, so the owner can reshape the whole
// layout by editing the template string — the grid is theirs to iterate; this file just
// declares clean regions.
//
// The surfaces are the same slot components as before (they read the shared `StudioProvider`
// state via `useStudio`); they are just mounted directly here in a grid instead of being
// interleaved through prose as `liveEmbed`s.

import GlossarySidebar from "./cards/GlossarySidebar";
import ExportSlot from "./slots/ExportSlot";
import RulesSlot from "./slots/RulesSlot";
import SeedSlot from "./slots/SeedSlot";
import TokensSlot from "./slots/TokensSlot";
import styles from "./StudioCanvas.module.css";

export default function StudioCanvas(): React.ReactElement {
  return (
    <div className={styles.canvas}>
      <div className={styles.seed}>
        <SeedSlot />
      </div>
      <div className={styles.rules}>
        <RulesSlot />
      </div>
      <div className={styles.cards}>
        <TokensSlot />
      </div>
      <div className={styles.glossary}>
        <GlossarySidebar />
      </div>
      <div className={styles.exports}>
        <ExportSlot />
      </div>
      {/* Reserved region for the #14 harmony decorative card group — named so it slots in
          without reshaping the grid. Empty (its auto row collapses) until #14 fills it. */}
      <div className={styles.harmony} />
    </div>
  );
}
