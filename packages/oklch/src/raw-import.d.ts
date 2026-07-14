/**
 * Vite's `?raw` import (a module's source text as a string) — the shim normally provided
 * by `vite/client`, which isn't resolvable here because vite is only a transitive
 * dependency of vitest. Used by the drift guard to read the barrel in both env projects.
 */
declare module "*?raw" {
  const source: string;
  export default source;
}
