import { Rose } from "lucide-react";
import Link from "next/link";

import styles from "./Logo.module.css";

const SITE_NAME = "jamie thompson";

interface LogoProps {
  /** The logo mark — any SVG. Rendered decorative; the link carries the name. */
  readonly children: React.ReactNode;
}

/**
 * The site logo — the header's home link (`/`), wrapping whatever mark it's given. A Server
 * Component with every interactive state designed here: rest, hover, focus-visible, and a
 * press. The mark is sized by the module's `--logo-size` token, so an SVG needs no width or
 * height attributes.
 */
/**
 * A stand-in until the designed mark exists. Passed explicitly at the mount site rather than
 * defaulted inside `Logo`, so the swap can't be forgotten.
 */
export function PlaceholderMark(): React.ReactElement {
  return <Rose />;
}

export default function Logo({ children }: LogoProps): React.ReactElement {
  return (
    // The link owns the accessible name (the site name) and the mark is hidden from AT — a
    // logo read as "graphic" plus a link name would announce the identity twice.
    <Link href="/" className={styles.logo} aria-label={SITE_NAME}>
      <span className={styles.mark} aria-hidden="true">
        {children}
      </span>
    </Link>
  );
}
