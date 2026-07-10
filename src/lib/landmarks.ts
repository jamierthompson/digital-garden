// The id the shell's skip-link (`SkipLink`) targets, stamped on every view's `<main>` landmark —
// the `Page` primitive AND the cold-state frames (loading / not-found / error), which render
// their own `<main>` outside `Page`. Kept in one place so the skip-link's anchor and its targets
// can never drift apart: a typo in either half would silently turn "Skip to content" into a dead
// anchor (WCAG 2.4.1). Side-effect-free, like `src/lib/keys.ts`.
export const MAIN_CONTENT_ID = "main-content";
