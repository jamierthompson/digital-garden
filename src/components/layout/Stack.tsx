import { Slot } from "radix-ui";

import styles from "./Stack.module.css";

interface StackProps extends React.ComponentPropsWithRef<"div"> {
  /**
   * Vertical gap between children as a CSS token reference — use `space(n)` from `@/lib/tokens`.
   * Omit for the default rhythm (the `--space-stack` semantic role). Any length token works, so a
   * future engine-derived `clamp()` value passes straight through the conduit.
   */
  readonly gap?: string;
  /**
   * Render the single child element instead of a wrapping `<div>` (Radix `Slot`), merging the
   * stack's class + token onto it — e.g. `<Stack asChild><ul>…</ul></Stack>` to stack real list
   * items without an extra wrapper.
   */
  readonly asChild?: boolean;
}

/**
 * Vertical layout primitive — lays its children out in a column with one consistent gap, and owns
 * nothing else. Content-agnostic: it reads the ambient space scale and doesn't care what it holds.
 * The `gap` prop is passed through an inline custom property (`--stack-gap`) rather than a computed
 * style, so a container query or a future type/space engine can override it in CSS without changing
 * the call site.
 */
export default function Stack({
  gap,
  asChild = false,
  className,
  style,
  ...rest
}: StackProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={[styles.stack, className].filter(Boolean).join(" ")}
      // The `style` prop is a shared channel (the primitive writes its token here), so merge
      // deliberately: token var first, caller's `style` last — an explicit caller override wins
      // (the escape hatch). The cast covers the custom property, which `CSSProperties` can't type.
      style={
        {
          ...(gap ? { "--stack-gap": gap } : null),
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    />
  );
}
