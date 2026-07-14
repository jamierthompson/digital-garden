import { Slot } from "radix-ui";

import styles from "./Container.module.css";

interface ContainerProps extends React.ComponentPropsWithRef<"div"> {
  /**
   * Render the single child element instead of a wrapping `<div>` (Radix `Slot`), merging the
   * container's class onto it — e.g. `<Container asChild><nav>…</nav></Container>` to cap a
   * band's own element without an extra wrapper.
   */
  readonly asChild?: boolean;
}

/**
 * The page-column band primitive — caps a full-bleed band's inner row to the page content
 * column (`--width-page`), centered, with the page gutter, and owns nothing else. For chrome
 * bands whose borders/backgrounds run full-bleed while their content aligns to the column the
 * page frames use. (The `<main>` landmark and its width roles stay `Page`'s.)
 */
export default function Container({
  asChild = false,
  className,
  ...rest
}: ContainerProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "div";
  return (
    <Component
      className={[styles.container, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
