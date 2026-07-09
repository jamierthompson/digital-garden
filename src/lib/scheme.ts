/**
 * The site-wide color scheme — a binary light ⇄ dark choice, seeded from the OS.
 *
 * The whole token system is emitted as native `light-dark()` literals keyed on the root
 * `color-scheme` (semantic/color.css binds `:root { color-scheme: light dark }`; the build keeps
 * `light-dark()` native — see next.config's `lightningCssFeatures`). So a scheme is applied by
 * setting `color-scheme` on `<html>`: every editorial AND brand token re-resolves natively,
 * with no per-component work.
 *
 * Until the visitor first flips the switch there is NO stored override — the CSS `light dark`
 * default follows the OS `prefers-color-scheme` (that path needs zero JS). The first flip
 * persists an explicit light/dark override that wins from then on; there is no return-to-system
 * affordance (the control is a binary switch, per the owner directive on #133).
 *
 * Persistence is `localStorage`; the flash-free first paint comes from `SCHEME_INIT_SCRIPT`
 * (below), an inline `<script>` the root layout runs before the body paints.
 *
 * Deliberately framework-agnostic and isomorphic (no `use client`, no top-level browser
 * access — every DOM read/write sits inside a function body): the root layout, a Server
 * Component, imports only the `SCHEME_INIT_SCRIPT` string, while the client switch island
 * (and the Color Engine's `ColorEngineProvider`, which re-binds its displayed scheme to this
 * setting) import the functions.
 */

export type Scheme = "light" | "dark";

/** `localStorage` key holding the persisted override; absent ⇒ follow the OS. */
export const SCHEME_STORAGE_KEY = "scheme";

// Same-tab change signal. A cross-tab change already arrives as a native `storage` event;
// this custom event covers the same-tab `setScheme` call that `storage` does NOT fire for.
const CHANGE_EVENT = "scheme:change";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isScheme(value: unknown): value is Scheme {
  return value === "light" || value === "dark";
}

/** Read the persisted override, or `null` when none is set (⇒ follow the OS). */
export function getStoredScheme(): Scheme | null {
  try {
    const stored = localStorage.getItem(SCHEME_STORAGE_KEY);
    return isScheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Write the inline `color-scheme` on `<html>`. An inline style out-ranks the layered
 * `:root { color-scheme: light dark }`, so the override wins and every native `light-dark()`
 * token re-resolves to the chosen scheme.
 */
export function applyScheme(scheme: Scheme): void {
  document.documentElement.style.colorScheme = scheme;
}

/** Persist an explicit scheme, apply it, and notify same-tab subscribers. */
export function setScheme(scheme: Scheme): void {
  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
  } catch {
    // Storage unavailable (private mode / disabled): still apply for this session.
  }
  applyScheme(scheme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Subscribe to scheme changes; returns an unsubscribe fn. Fires on a same-tab `setScheme`, on
 * a cross-tab `storage` change (re-applying the new value in this tab), and — so
 * `getResolvedScheme()` stays fresh while no override is set — on an OS `prefers-color-scheme`
 * flip. This is the single signal the Color Engine's `ColorEngineProvider` swaps its `matchMedia`
 * read for.
 */
export function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === SCHEME_STORAGE_KEY) {
      const stored = getStoredScheme();
      // Mirror the init script: an override applies, its absence CLEARS the inline scheme so
      // the native `light dark` default resumes. Clearing (not just setting) keeps the DOM and
      // `getResolvedScheme()` in agreement if another tab removes/invalidates the override.
      if (stored) applyScheme(stored);
      else document.documentElement.style.removeProperty("color-scheme");
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onChange);
  };
}

/** The effective scheme right now: the explicit override if set, else the OS preference. */
export function getResolvedScheme(): Scheme {
  return (
    getStoredScheme() ??
    (window.matchMedia(DARK_QUERY).matches ? "dark" : "light")
  );
}

/**
 * The flash-free init script, run inline by the root layout before the body paints. Reads the
 * persisted override and, for an explicit light/dark, sets `color-scheme` on `<html>` so the
 * correct scheme is in effect for first paint. No override ⇒ do nothing — the CSS `light dark`
 * default already follows the OS, so there is nothing to flash past. Standalone (it runs
 * before any bundle), self-guarding, and reads the one storage key by literal. */
export const SCHEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  SCHEME_STORAGE_KEY,
)});if(s==="light"||s==="dark"){document.documentElement.style.colorScheme=s}}catch(e){}})();`;
