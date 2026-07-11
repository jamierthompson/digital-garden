import { Slot } from "radix-ui";

import styles from "./Grid.module.css";

interface GridProps extends React.ComponentPropsWithRef<"div"> {
  /**
   * The column floor — the `minmax()` minimum each column is laid out to, as a CSS length. Passed
   * through the `--grid-min` conduit; columns then fill intrinsically (`auto-fit`, no breakpoints),
   * so a narrower container wraps to fewer columns on its own. Required — a column floor is
   * design-specific per grid, with no universal default, so the caller always names one.
   */
  readonly min: string;
  /**
   * The gap between cells, passed through the `--grid-gap` conduit — use `space(n)` from
   * `@/lib/tokens`. Omit for the default (the `--space-grid` semantic role).
   */
  readonly gap?: string;
  /**
   * Render the single child element instead of a wrapping `<div>` (Radix `Slot`), merging the
   * grid's class + tokens onto it — e.g. `<Grid asChild><ul>…</ul></Grid>` to lay out real list
   * items without an extra wrapper.
   */
  readonly asChild?: boolean;
}

/**
 * Intrinsic responsive-grid primitive — lays its children into as many equal columns as fit, each
 * at least `min` wide, wrapping with no media queries. Content-agnostic: it reads only the `min`
 * floor and `gap` and doesn't care what it holds. Both props pass through inline custom properties
 * (`--grid-min`, `--grid-gap`) rather than computed styles, so a container query or a future
 * space engine can override them in CSS without changing the call site.
 */
export default function Grid({
  min,
  gap,
  asChild = false,
  className,
  style,
  ...rest
}: GridProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={[styles.grid, className].filter(Boolean).join(" ")}
      // The `style` prop is a shared channel (the primitive writes its tokens here), so merge
      // deliberately: token vars first, caller's `style` last — an explicit caller override wins
      // (the escape hatch). The cast covers the custom properties, which `CSSProperties` can't type.
      style={
        {
          "--grid-min": min,
          ...(gap ? { "--grid-gap": gap } : null),
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    />
  );
}
