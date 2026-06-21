/**
 * Breakpoints as build-time constants, not `:root` custom properties — CSS variables
 * are invalid inside `@media` conditions [D22]. These feed JS (matchMedia, etc.);
 * CSS uses container queries or the matching literal px values.
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Build a `min-width` media query string for a breakpoint, e.g. for matchMedia. */
export function minWidth(bp: Breakpoint): string {
  return `(min-width: ${breakpoints[bp]}px)`;
}
