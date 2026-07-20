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

// The OS preference is client-only, so the server and first hydration render both read "light"
// and the markup matches. Colors are already correct pre-paint via the layout's inline init
// script, so only the glyph settles — no theme flash, and both glyphs share one box.
function getServerScheme(): Scheme {
  return "light";
}

/**
 * The site-wide light/dark scheme control — the shell chrome's one client island. A button
 * showing the CURRENT scheme's glyph, seeded from the OS `prefers-color-scheme` until the first
 * press persists an override; pressing re-solves every native `light-dark()` token site-wide.
 *
 * The glyph is decorative and the accessible name states the ACTION, which is what a button must
 * announce — a glyph alone leaves a screen-reader user guessing whether it reports the scheme
 * they are in or the one they would get.
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
