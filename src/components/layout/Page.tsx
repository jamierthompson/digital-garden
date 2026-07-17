import { MAIN_CONTENT_ID } from "@/lib/landmarks";

import ContentGrid from "./ContentGrid";
import styles from "./Page.module.css";

/**
 * The route content frame — the single `<main>` landmark every route mounts, and the page's
 * instance of the shared content grid (`ContentGrid` merged onto the `<main>` itself). All
 * inline sizing is the grid's: children land in the `prose` lane unless they take `wide` or
 * `full`. Page adds only what the grid doesn't own — the landmark, the skip-link target, and
 * the frame's block padding.
 */
export default function Page({
  className,
  ...rest
}: React.ComponentPropsWithRef<"main">): React.ReactElement {
  return (
    <ContentGrid asChild>
      <main
        id={MAIN_CONTENT_ID}
        // The skip-link moves focus here; a `<main>` isn't focusable by default, so `tabIndex={-1}`
        // lets it receive programmatic focus (the standard skip-target pattern). Both are ahead of
        // `{...rest}`, so a caller can still override either.
        tabIndex={-1}
        className={[styles.page, className].filter(Boolean).join(" ")}
        {...rest}
      />
    </ContentGrid>
  );
}
