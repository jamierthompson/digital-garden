import { Slot } from "radix-ui";

import styles from "./ContentGrid.module.css";

interface ContentGridProps extends React.ComponentPropsWithRef<"div"> {
  /**
   * Render the single child element instead of a wrapping `<div>` (Radix `Slot`), merging the
   * grid class onto it — e.g. to make a semantic `<article>` the grid itself.
   */
  readonly asChild?: boolean;
}

/**
 * The content-grid layout primitive — a full-width grid of three named lanes: `prose` (the reading
 * measure and default lane), `wide` (a breakout past prose), and `full` (edge to edge). The gutter
 * lives in the grid's tracks, so `full` reaches the true viewport edge while `prose` and `wide`
 * stay inset. Children land in `prose` unless they set their own `grid-column`. Owns the column
 * lanes only — vertical rhythm, ink, and band styling stay with the consumer.
 */
export default function ContentGrid({
  asChild = false,
  className,
  ...rest
}: ContentGridProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={[styles.grid, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
