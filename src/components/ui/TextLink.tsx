import { Slot } from "radix-ui";

import styles from "./TextLink.module.css";

/** The inline text-link treatments — the ink + state bundle a link wears. */
export type TextLinkVariant = "quiet" | "accent" | "muted" | "brand";

interface TextLinkProps extends React.ComponentPropsWithRef<"a"> {
  /**
   * The link treatment: `quiet` (a title/heading link — ambient ink, text-grade accent +
   * underline on hover), `accent` (an inline prose link — always underlined, accent ink),
   * `muted` (quiet chrome wayfinding — muted ink, foreground on hover / for the current page, no
   * underline), or `brand` (the wordmark home link — accent ink, brightening on hover, no
   * underline). Each applies that variant's `--<role>` ink bundle (selected by `data-variant`).
   */
  readonly variant: TextLinkVariant;
  /**
   * Render the single child element instead of a bare `<a>` (Radix `Slot`), merging the link's
   * class + `data-variant` onto it — e.g. `<TextLink variant="quiet" asChild><Link href=…>…
   * </Link></TextLink>` to wear the treatment on a `next/link` or `HoverPrefetchLink`.
   */
  readonly asChild?: boolean;
}

/**
 * Inline text-link primitive — owns the link ink roles + hover/underline states, and nothing
 * else. Defaults to a bare `<a>` (external links); `asChild` slots the treatment onto a
 * `next/link` / `HoverPrefetchLink` without an extra wrapper. The focus ring is the global
 * `:focus-visible` (reset.css); layout (a standalone control's tap-target floor) stays with the
 * consumer. Extends the intrinsic `<a>` props (href, rel, className, data-*, aria, handlers all
 * pass through) and forwards its ref.
 */
export default function TextLink({
  variant,
  asChild = false,
  className,
  ...rest
}: TextLinkProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "a";
  return (
    <Component
      className={[styles.link, className].filter(Boolean).join(" ")}
      {...rest}
      // `data-variant` selects the ink bundle in the module. Spread `rest` first so the typed
      // prop always wins over a stray literal `data-variant` passthrough.
      data-variant={variant}
    />
  );
}
