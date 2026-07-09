import { Slot } from "radix-ui";

import styles from "./Text.module.css";

/**
 * The non-heading semantic type roles. Named `variant` on the prop (not `role`) so it can't
 * collide with the ARIA `role` attribute, which stays available as a passthrough.
 */
export type TextVariant = "body" | "lead" | "label" | "meta";

interface TextProps extends React.ComponentPropsWithRef<"p"> {
  /**
   * The semantic type role to apply — `body` (running copy, the default), `lead` (an intro /
   * blurb, a notch larger than body), `label` (kickers / eyebrows / section labels), or `meta`
   * (metadata, timestamps, mono readouts). Each applies that role's token bundle
   * (`--type-{body,lead,label,meta}-*` in `foundation.css`).
   */
  readonly variant?: TextVariant;
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
  asChild = false,
  className,
  ...rest
}: TextProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "p";
  return (
    <Component
      className={[styles.text, className].filter(Boolean).join(" ")}
      // `data-variant` selects the role bundle in the module (the base class is `body`).
      data-variant={variant}
      {...rest}
    />
  );
}
