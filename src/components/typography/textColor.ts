/**
 * The semantic ink roles a type primitive can wear via its `color` prop — each names the
 * `--<role>` semantic color token it resolves to. Only roles actually worn by static text
 * belong here (hover/state inks stay in CSS — a prop can't express `:hover`), and only
 * TEXT-GRADE tokens qualify: every role listed solves to 4.5:1 (Lc 60+) against the page
 * surface, so an ink choice can never produce an under-contrast reading. A runtime array
 * (not just a type) so the module test can pin the CSS rules to this list.
 */
export const TEXT_COLORS = [
  "foreground",
  "muted-foreground",
  "accent-text",
  "harmony-analogous-a-text",
  "harmony-analogous-b-text",
  "harmony-complementary-text",
  "harmony-triadic-a-text",
  "harmony-triadic-b-text",
  "harmony-split-complementary-a-text",
  "harmony-split-complementary-b-text",
] as const;

export type TextColor = (typeof TEXT_COLORS)[number];
