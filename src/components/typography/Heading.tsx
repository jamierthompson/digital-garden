import { Slot } from "radix-ui";

import styles from "./Heading.module.css";

/** The six document heading levels — the rendered `<h1>`–`<h6>`. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** The type role a heading may wear, decoupled from its level. */
export type HeadingVariant =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "lead"
  | "body"
  | "label"
  | "meta";

interface HeadingProps extends React.ComponentPropsWithRef<"h1"> {
  /**
   * The heading level → the rendered `<h1>`–`<h6>` element and its place in the document outline.
   * Choose it by the outline, never to hit a look — set `variant` for that. With no `variant`, the
   * level drives the type through a semantic role: 1 → `title`, 2 → `heading`, 3–6 → `subheading`
   * (the oversized `display` role is opt-in via `variant`, for a landing hero, not a level default).
   */
  readonly level: HeadingLevel;
  /**
   * The type ROLE the heading wears, decoupled from `level` (which stays the semantic `<hN>`).
   * Omit to follow the level (1 → `title`, 2 → `heading`, 3–6 → `subheading`). Set it to style a
   * heading as any role without moving it in the outline — e.g. `<Heading level={1} variant=
   * "display">` for the hero, `<Heading level={2} variant="label">` for a section kicker, or
   * `<Heading level={1} variant="heading">` for a quieter title. An explicit variant applies that
   * role's bundle.
   */
  readonly variant?: HeadingVariant;
  /**
   * Render the single child element instead of the `<hN>` wrapper (Radix `Slot`), merging class +
   * `data-*` onto it. Note the child REPLACES the heading element — use it only when the child
   * itself is the heading you want; it does NOT add an `<hN>` to the document outline.
   */
  readonly asChild?: boolean;
}

/**
 * Semantic heading primitive — renders the `<hN>` for its `level` and applies a type role, and
 * owns nothing else. The role is chosen by `variant`, or by the level when `variant` is omitted;
 * either way the type comes from the semantic role bundle (`--type-{role}-*` in `semantic/type.css`),
 * whose sizes bind to the `@garden/type` scale steps — the primitive reads only the semantic layer,
 * never a raw `--type-size-*` step. Discrete roles are applied via a `data-*` attribute (the variant
 * mechanism), not the value-conduit the spacing primitives use for continuous lengths. Extends the
 * intrinsic heading props (className, style, data-attributes, aria, handlers) and forwards its ref.
 */
export default function Heading({
  level,
  variant,
  asChild = false,
  className,
  ...rest
}: HeadingProps): React.ReactElement {
  const Component = asChild ? Slot.Root : (`h${level}` as const);
  return (
    <Component
      className={[styles.heading, className].filter(Boolean).join(" ")}
      // `data-level` drives the per-level default; `data-variant` (when set) overrides it with the
      // role's canonical bundle. Both are read by the module.
      data-level={level}
      data-variant={variant}
      {...rest}
    />
  );
}
