import { Slot } from "radix-ui";

import styles from "./Cluster.module.css";

interface ClusterProps extends React.ComponentPropsWithRef<"div"> {
  /**
   * Gap between items as a CSS token reference — use `space(n)` from `@/lib/tokens`. Omit for the
   * default meta-row spacing (the `--space-cluster` semantic role). Any length token works, so a
   * future engine-derived `clamp()` value passes straight through the conduit.
   */
  readonly gap?: string;
  /**
   * Render the single child element instead of a wrapping `<div>` (Radix `Slot`), merging the
   * cluster's class + token onto it — e.g. `<Cluster asChild><div>…</div></Cluster>` to make an
   * existing row wrap inline without an extra element.
   */
  readonly asChild?: boolean;
}

/**
 * Horizontal layout primitive — lays its children out in a row that wraps, with one consistent gap,
 * and owns nothing else. Content-agnostic: it reads the ambient space scale and doesn't care what it
 * holds. Sets no cross-axis alignment, so a consumer keeps its own `align-items` with no cascade
 * conflict. The `gap` prop is passed through an inline custom property (`--cluster-gap`) rather than
 * a computed style, so a container query or a future type/space engine can override it in CSS
 * without changing the call site.
 */
export default function Cluster({
  gap,
  asChild = false,
  className,
  style,
  ...rest
}: ClusterProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={[styles.cluster, className].filter(Boolean).join(" ")}
      // The `style` prop is a shared channel (the primitive writes its token here), so merge
      // deliberately: token var first, caller's `style` last — an explicit caller override wins
      // (the escape hatch). The cast covers the custom property, which `CSSProperties` can't type.
      style={
        {
          ...(gap ? { "--cluster-gap": gap } : null),
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    />
  );
}
