"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./ShellNav.module.css";

/** A primary-nav destination. `label` is the visible journal-style lowercase item. */
interface NavItem {
  readonly href: string;
  readonly label: string;
}

// The global editorial IA: the featured front door, the browse Index, and the shell pages.
// `featured` and the `folio_` logo both point home (the logo is branding, `featured` is the
// wayfinding item that carries the active state on `/`). Kept a module constant, not inlined,
// so the set has one source of truth.
// The Index lives at `/browse` (not `/index`: Next prerenders the root route `/` to
// `index.html`, so a route named `index` collides with home at the static-serving layer).
// The visible label is still the journal "index".
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "featured" },
  { href: "/browse", label: "index" },
  { href: "/now", label: "now" },
  { href: "/about", label: "about" },
  { href: "/system", label: "system" },
];

function isActive(pathname: string, href: string): boolean {
  // Home matches only the exact root; every other section also matches its descendants
  // (e.g. a future `/system/tokens` still lights `system`).
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The shell's primary nav links, split into a small Client Component so the current-page
 * indicator can read `usePathname` without dragging the server-rendered header
 * (`ShellNav`) to the client. Var-consuming only: reads the global editorial tokens
 * (`--font-display`, `--text`, `--border`) — the shell is never brand-scoped.
 */
export default function NavLinks(): React.ReactElement {
  const pathname = usePathname();

  return (
    <ul className={styles.links}>
      {NAV_ITEMS.map(({ href, label }) => {
        const active = isActive(pathname ?? "", href);
        return (
          <li key={href}>
            <Link
              href={href}
              className={`${styles.link} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
