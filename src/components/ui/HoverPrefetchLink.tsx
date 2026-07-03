"use client";

import Link, { type LinkProps } from "next/link";
import { useState, type AnchorHTMLAttributes, type ReactNode } from "react";

type HoverPrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

/**
 * A `next/link` that defers prefetch from Next's default viewport-triggered timing to real
 * hover/touch intent — the framework's own documented pattern for a data-driven list of links
 * (node_modules/next/dist/docs/01-app/02-guides/prefetching.md, "Preventing too many
 * prefetches"). Each link here points at its own route's CSS; viewport-prefetching every one on
 * load floods the critical path with preloads the browser then flags as unused.
 */
export default function HoverPrefetchLink({
  children,
  ...linkProps
}: HoverPrefetchLinkProps) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...linkProps}
      prefetch={active ? null : false}
      onMouseEnter={() => setActive(true)}
    >
      {children}
    </Link>
  );
}
