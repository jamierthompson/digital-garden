import { Slot } from "radix-ui";

import styles from "./Text.module.css";
import type { TextColor } from "./textColor";
import colorStyles from "./textColor.module.css";

/**
 * The non-heading semantic type roles. Named `variant` on the prop (not `role`) so it can't
 * collide with the ARIA `role` attribute, which stays available as a passthrough.
 */
export type TextVariant =
  | "body"
  | "lede"
  | "label"
  | "meta"
  | "kicker"
  | "caption"
  | "quote";

interface TextProps extends React.ComponentPropsWithRef<"p"> {
  /**
   * The semantic type role to apply — `body` (running copy, the default), `lede` (an intro /
   * summary, a notch larger than body), `label` (eyebrows / section labels), `meta`
   * (metadata, timestamps, readouts), `kicker` (the superhead above a page's h1, naming
   * what the page is before the headline says it), `caption` (small muted secondary prose —
   * figure / video captions, a quote's attribution), or `quote` (a pull-quote's body). Each
   * applies that role's token bundle (`--type-{role}-*` in `semantic/type.css`).
   */
  readonly variant?: TextVariant;
  /**
   * The semantic ink role — names the `--<role>` color token the text wears (via the shared
   * `textColor` rules). Omit to inherit the ambient ink, exactly as before the prop existed.
   */
  readonly color?: TextColor;
  /**
   * Render the single child element instead of a `<p>` wrapper (Radix `Slot`) — e.g.
   * `<Text variant="meta" asChild><time>…</time></Text>` to wear a role on an inline element.
   */
  readonly asChild?: boolean;
}

/**
 * Semantic text primitive for non-heading copy — applies a type role and owns nothing else.
 * Defaults to a `<p>` in the `body` role; `asChild` renders any element (a `<span>`, `<time>`,
 * `<li>`) wearing the role without an extra wrapper. Extends the intrinsic element props
 * (className, style, data-attributes, aria, and handlers all pass through) and forwards its ref.
 */
export default function Text({
  variant = "body",
  color,
  asChild = false,
  className,
  ...rest
}: TextProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "p";
  return (
    <Component
      className={[styles.text, color && colorStyles.ink, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
      // `data-variant` selects the role bundle in the module (the base class is `body`);
      // `data-color` (when set) selects the ink. Spread `rest` first so the typed props always win
      // over a stray literal `data-*` passthrough.
      data-variant={variant}
      data-color={color}
    />
  );
}
