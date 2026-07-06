// The Color Engine canvas (#154, #139) — the prose-less, Experience-centered composition. Every
// surface the Color Engine has (the seed input, the rules, the swatch-card grid, the shared glossary,
// the export, and a reserved region for the future harmony group) is mounted ONCE in a single
// top-level CSS grid whose `grid-template-areas` are NAMED, so the owner can reshape the whole
// layout by editing the template string — the grid is theirs to iterate; this file just
// declares clean regions.
//
// The surfaces are the same slot components as before (they read the shared `ColorEngineProvider`
// state via `useColorEngine`); they are just mounted directly here in a grid instead of being
// interleaved through prose as `liveEmbed`s.

import ScrollArea from "@/components/ui/ScrollArea";

import GlossarySidebar from "./cards/GlossarySidebar";
import HarmonyGroup from "./cards/HarmonyGroup";
import ExportSlot from "./slots/ExportSlot";
import PaletteTableSlot from "./slots/PaletteTableSlot";
import PreviewSlot from "./slots/PreviewSlot";
import RulesSlot from "./slots/RulesSlot";
import SeedSlot from "./slots/SeedSlot";
import TokensSlot from "./slots/TokensSlot";
import styles from "./ColorEngineCanvas.module.css";

export default function ColorEngineCanvas(): React.ReactElement {
  return (
    // The scroll container (#139): mounted under `EntryScope` by `ColorEngineExperience`/
    // `[slug]/page.tsx`. Its thumb's `var(--accent)` (see `ScrollArea.module.css`) resolves to the
    // page's engine-themed accent — the Color Engine route stamps its brand on `<html>`, so the thumb
    // gets the derived brand color, not the `:root` engine fallback, re-theming per route
    // automatically with no per-use wiring. `.scrollArea`
    // gives it the bounded block-size a Radix ScrollArea needs (see `ScrollArea`'s own doc
    // comment); the exact bound is a first-pass the owner tunes live (#139: "most of the tool
    // visible when colors change", not a mandated fixed viewport stage).
    <ScrollArea className={styles.scrollArea}>
      <div className={styles.canvas}>
        {/* DOM (= keyboard / reading) order follows the visual grid order the owner set: the
            seed+starters control bar leads, the decorative harmony group next, then the working
            surfaces. `grid-template-areas` (ColorEngineCanvas.module.css) places each region; this
            source order keeps focus tracking what the eye sees. */}
        <div className={styles.seed}>
          <SeedSlot />
        </div>
        <div className={styles.rules}>
          <RulesSlot />
        </div>
        {/* The #14 decorative harmony card group — its own named region, separated from the
            contract-bearing semantic cards. */}
        <div className={styles.harmony}>
          <HarmonyGroup />
        </div>
        <div className={styles.cards}>
          <TokensSlot />
        </div>
        {/* The restored palette table (#154 companion) — a compact row-per-token scan of the
            same data the cards show, alongside them rather than replacing them. */}
        <div className={styles.table}>
          <PaletteTableSlot />
        </div>
        <div className={styles.preview}>
          <PreviewSlot />
        </div>
        <div className={styles.exports}>
          <ExportSlot />
        </div>
        {/* The shared glossary (#154) — a bottom full-width row of definitions, last in the
            canvas above the footer. */}
        <div className={styles.glossary}>
          <GlossarySidebar />
        </div>
      </div>
    </ScrollArea>
  );
}
