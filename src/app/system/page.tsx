import type { Metadata } from "next";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "System",
  description:
    "The design system and colophon behind the garden — tokens, the OKLCH color engine, type, and stack. In progress.",
};

/**
 * The shell System page — the site's own design-system / colophon surface (the site
 * documenting itself). A titled stub for now: the route and nav item exist so the IA is
 * complete; the real content (token tiers, the OKLCH engine, the type system, the stack)
 * lands in a later slice. Static editorial chrome — reads the global semantic tokens, no
 * brand scope of its own.
 */
export default function SystemPage() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>colophon</p>
      <h1 className={styles.title}>System</h1>
      <p className={styles.lede}>
        The design system behind the garden — the token tiers, the OKLCH color
        engine, the type system, and the stack, documented in the open. This
        page is being written.
      </p>
    </main>
  );
}
