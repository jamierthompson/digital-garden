import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import styles from "./VisuallyHidden.module.css";

type VisuallyHiddenProps<T extends ElementType> = {
  /** The element to render — defaults to `span`. Pass a heading (`h2`, …) to keep an
   *  accessible section label the visual design omits. */
  as?: T;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/**
 * Renders content that is invisible on screen but still exposed to assistive technology — the
 * standard "visually hidden" / sr-only pattern (a 1px clipped box, not `display: none`, so it
 * stays in the accessibility tree). Use for a label a sighted user doesn't need but a screen
 * reader or the document outline does (e.g. a section heading the layout omits).
 *
 * Polymorphic via `as` so the hidden node carries the correct semantics — a hidden section
 * label must remain a real heading, not a `span`.
 */
export default function VisuallyHidden<T extends ElementType = "span">({
  as,
  children,
  ...props
}: VisuallyHiddenProps<T>): ReactNode {
  const Component: ElementType = as ?? "span";
  return (
    <Component className={styles.hidden} {...props}>
      {children}
    </Component>
  );
}
