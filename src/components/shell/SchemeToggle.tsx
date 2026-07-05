"use client";

import { useSyncExternalStore } from "react";

import Switch from "@/components/ui/Switch";
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
// switch's thumb position settles after hydration — no theme flash, no layout shift.
function getServerScheme(): Scheme {
  return "light";
}

/**
 * The site-wide light/dark scheme control — the single client island in the shell chrome
 * (`SiteNav` and the layout stay Server Components). A binary Radix `Switch` (via the shared
 * `ui/Switch`), on = dark, seeded from the OS `prefers-color-scheme` until the first flip
 * persists an explicit override. Flipping re-solves every native `light-dark()` token live,
 * site-wide, through `@/lib/scheme`. Flanking sun/moon icons (decorative, `aria-hidden`) make
 * it read as the conventional dark-mode toggle; the switch itself carries the accessible name
 * and announced on/off state.
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

  return (
    <span className={styles.toggle}>
      <SunIcon active={!isDark} />
      <Switch
        label="Dark mode"
        checked={isDark}
        onCheckedChange={(checked) => setScheme(checked ? "dark" : "light")}
      />
      <MoonIcon active={isDark} />
    </span>
  );
}

function SunIcon({ active }: { active: boolean }): React.ReactElement {
  return (
    <svg
      className={`${styles.icon} ${active ? styles.active : ""}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ active }: { active: boolean }): React.ReactElement {
  return (
    <svg
      className={`${styles.icon} ${active ? styles.active : ""}`}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
