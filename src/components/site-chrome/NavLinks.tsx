"use client";

import { usePathname } from "next/navigation";

import HoverPrefetchLink from "@/components/ui/HoverPrefetchLink";
import TextLink from "@/components/ui/TextLink";

import styles from "./NavLinks.module.css";

/** A primary-nav destination. `label` is the visible journal-style lowercase item. */
interface NavItem {
  readonly href: string;
  readonly label: string;
}

// The global editorial IA: the featured front door, the browse Index, and the shell pages.
// `featured` points home and is the wayfinding item that carries the active state on `/`.
// Kept a module constant, not inlined, so the set has one source of truth.
// The Index lives at `/browse` (not `/index`: Next prerenders the root route `/` to
// `index.html`, so a route named `index` collides with home at the static-serving layer).
// The visible label is still the journal "index".
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "featured" },
  { href: "/browse", label: "index" },
  { href: "/system", label: "system" },
  { href: "/about", label: "about" },
  { href: "/now", label: "now" },
];

function isActive(pathname: string, href: string): boolean {
  // Home matches only the exact root; every other section also matches its descendants
  // (e.g. a future `/system/tokens` still lights `system`).
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

interface NavLinksProps extends React.ComponentPropsWithRef<"ul"> {
  /**
   * The links' own treatment, not their layout — the CONSUMER owns layout by wrapping this in
   * the primitive it wants. `stack` makes each link fill its row so the tap target is the row
   * rather than the word; `row` (the default) keeps a short label centred in its 24px floor.
   */
  readonly orientation?: "row" | "stack";
  /**
   * Called when a destination is activated. The mobile panel lives in the persistent layout, so
   * a client-side navigation does NOT unmount it — without this the panel would still be covering
   * the page the user just navigated to.
   */
  readonly onNavigate?: () => void;
}

/**
 * The shell's primary nav links, split into a small Client Component so the current-page
 * indicator can read `usePathname` without dragging the server-rendered header
 * (`SiteNav`) to the client. Var-consuming only: reads the global editorial tokens
 * (`--font-heading`, `--foreground`, `--border`) — the shell is never theme-scoped.
 */
export default function NavLinks({
  orientation = "row",
  onNavigate,
  className,
  ...rest
}: NavLinksProps = {}): React.ReactElement {
  const pathname = usePathname();

  return (
    <ul
      className={[
        styles.links,
        orientation === "stack" ? styles.stack : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(pathname ?? "", href);
        return (
          <li key={href}>
            <TextLink
              variant="muted"
              asChild
              className={active ? styles.active : undefined}
              aria-current={active ? "page" : undefined}
            >
              <HoverPrefetchLink
                href={href}
                className={styles.link}
                onClick={onNavigate}
              >
                <span className={styles.label}>{label}</span>
              </HoverPrefetchLink>
            </TextLink>
          </li>
        );
      })}
    </ul>
  );
}
