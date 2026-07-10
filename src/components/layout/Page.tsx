import { Slot } from "radix-ui";

import { MAIN_CONTENT_ID } from "@/lib/landmarks";

import styles from "./Page.module.css";

/** The content-width roles a page frame can take — each names a `--width-*` foundation measure. */
type PageWidth = "measure" | "content" | "page";

interface PageProps extends React.ComponentPropsWithRef<"main"> {
  /**
   * The content-width role — `measure` (42rem) · `content` (48rem) · `page` (72rem). Selects the
   * `--width-<role>` foundation token, passed through the `--page-width` conduit so a future engine
   * value could override it in CSS without touching the call site. Defaults to `content`.
   */
  readonly width?: PageWidth;
  /**
   * Render the single child element instead of the wrapping `<main>` (Radix `Slot`), merging the
   * frame's class, `--page-width`, and `id` onto it — for a route whose frame must be a different
   * element while still owning the landmark.
   */
  readonly asChild?: boolean;
}

/**
 * The page-frame primitive — the single `<main>` landmark and content frame every route mounts,
 * replacing the hand-rolled per-route frames. It owns one structural concern: the width cap (from
 * the `width` role), horizontal centering, and the page gutter. It is the skip-link target
 * (`id="main-content"`, set once here, overridable via passthrough).
 */
export default function Page({
  width = "content",
  asChild = false,
  className,
  style,
  ...rest
}: PageProps): React.ReactElement {
  const Component = asChild ? Slot.Root : "main";
  return (
    <Component
      id={MAIN_CONTENT_ID}
      // The skip-link moves focus here; a `<main>` isn't focusable by default, so `tabIndex={-1}`
      // lets it receive programmatic focus (the standard skip-target pattern). Both are ahead of
      // `{...rest}`, so a caller can still override either.
      tabIndex={-1}
      className={[styles.page, className].filter(Boolean).join(" ")}
      // The `style` prop is a shared channel (the primitive writes its width token here), so merge
      // deliberately: token var first, caller's `style` last — an explicit caller override wins
      // (the escape hatch). The cast covers the custom property, which `CSSProperties` can't type.
      style={
        {
          "--page-width": `var(--width-${width})`,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    />
  );
}
