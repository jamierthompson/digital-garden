/**
 * The semantic ink roles a type primitive can wear via its `color` prop — each names the
 * `--<role>` semantic color token it resolves to. Only roles actually worn by static text
 * belong here (hover/state inks stay in CSS — a prop can't express `:hover`). A runtime
 * array (not just a type) so the module test can pin the CSS rules to this list.
 */
export const TEXT_COLORS = [
  "foreground",
  "muted-foreground",
  "accent-text",
] as const;

export type TextColor = (typeof TEXT_COLORS)[number];
