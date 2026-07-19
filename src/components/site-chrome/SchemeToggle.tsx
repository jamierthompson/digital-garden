"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import {
  getResolvedScheme,
  type Scheme,
  setScheme,
  subscribe,
} from "@/lib/scheme";

import styles from "./SchemeToggle.module.css";

// The server and first hydration render read "light" (the OS preference is client-only), so the
// markup matches and there's no hydration mismatch; React then re-renders from the real scheme.
// The *colors* are already correct pre-paint via the layout's inline init script, so only the
// icon settles after hydration — no theme flash, no layout shift (both glyphs share one box).
function getServerScheme(): Scheme {
  return "light";
}

/**
 * The site-wide light/dark scheme control — the single client island in the shell chrome
 * (`SiteNav` and the layout stay Server Components). A plain button showing the CURRENT
 * scheme's glyph (sun in light, moon in dark), seeded from the OS `prefers-color-scheme` until
 * the first press persists an explicit override. Pressing re-solves every native `light-dark()`
 * token live, site-wide, through `@/lib/scheme`.
 *
 * The glyph is decorative; the accessible name states the ACTION the press performs, which is
 * what a button must announce — the glyph alone would leave a screen-reader user guessing
 * whether it reports the current scheme or the one they'd get.
 *
 * `useSyncExternalStore` binds it to the resolved scheme (and to cross-tab / OS changes) — the
 * React-standard way to read an external store with a correct server snapshot.
 */
export default function SchemeToggle(): React.ReactElement {
  const scheme = useSyncExternalStore(
    subscribe,
    getResolvedScheme,
    getServerScheme,
  );
  const isDark = scheme === "dark";
  const Glyph = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={() => setScheme(isDark ? "light" : "dark")}
    >
      <Glyph className={styles.icon} aria-hidden="true" />
    </button>
  );
}
