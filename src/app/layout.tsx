import type { Metadata } from "next";

// LOAD-BEARING IMPORT ORDER — do not reorder, and do not enable an import-sorter.
// layers.css declares `@layer base, components;` and MUST be the first side-effect
// import; every style sheet MUST precede `next/font` and the component imports. Turbopack anchors
// the route's FIRST emitted stylesheet to whatever is imported first; if a `next/font`/component
// chunk lands first it registers `@layer components` as the LOWEST layer, so the base reset
// out-ranks every component rule and zeroes their padding/margin. Pinned by layout.test.ts.
import "../styles/layers.css";
import "../styles/reset.css";
import "../styles/foundation/space.css";
import "../styles/foundation/typography.css";
import "../styles/foundation/motion.css";
import "../styles/foundation/dimension.css";
import "../styles/foundation/focus.css";
import "../styles/foundation/radius.css";
import "../styles/foundation/border.css";
import "../styles/semantic/radius.css";
import "../styles/semantic/space.css";
import "../styles/semantic/type.css";
import "../styles/semantic/typography.css";
import "../styles/semantic/color.css";

// Binding imports (no CSS side-effect that moves the Turbopack stylesheet anchor pinned above),
// so they sit safely after the global sheets.
import { Geist_Mono, Instrument_Sans } from "next/font/google";

import NavVisibility from "@/components/site-chrome/NavVisibility";
import ScrollActivity from "@/components/site-chrome/ScrollActivity";
import SiteNav from "@/components/site-chrome/SiteNav";
import SiteFooter from "@/components/site-chrome/SiteFooter";
import SkipLink from "@/components/site-chrome/SkipLink";
import { FONT_FACES } from "@/fonts/roster";
import { SCHEME_INIT_SCRIPT } from "@/lib/scheme";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";
import SanityLiveMount from "@/sanity/SanityLiveMount";
import VisualEditingControls from "@/sanity/VisualEditingControls";

// The shell's editorial voice is Newsreader — `--font-heading` AND `--font-body`, one family
// separated by optical grade rather than by face (semantic/typography.css maps both) — and
// Newsreader is ALSO a roster face, so the shell reuses that roster `.variable` (mounted
// below) rather than declaring a duplicate loader. Instrument Sans is the UI voice
// (`--font-ui`: nav, meta, labels — the chrome's grounding sans), shell-only, loaded here.
// Mono carries code semantics only.
//
// `preload: false` matches the shell posture (accessibility-and-performance.md): the preload
// policy preloads only above-the-fold faces via a manual `<link>`, since `next/font` can't
// statically target a runtime-selected face — so no loader here flips preload on. (#38.)
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Geist Mono is the site's mono face — the semantic `--font-mono` default
// (semantic/typography.css) maps to `var(--font-geist-mono)`, so mounting its `.variable` on
// <html> brings that variable into scope for all chrome (metadata/readouts). Never above the
// fold on the shell routes, so `preload: false`.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await sanityFetch(SITE_SETTINGS_QUERY);
  const title = settings?.title ?? "Digital Garden";
  const description =
    settings?.description ?? "A personal portfolio and digital garden.";

  return {
    title: {
      default: title,
      template: `%s · ${title}`,
    },
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `SiteNav`/`SiteFooter` render once here, above the pages, and inherit the page's theme each
  // page emits via `<PageTheme>` — a hoisted `:root` `<style>` on hard load (React lifts it into
  // `<head>` ahead of this chrome, flash-free), re-stamped imperatively on `<html>` on soft nav.
  // So the persistent chrome wears the visible page's authored theme with no per-component work;
  // the `src/styles` `@layer` token defaults sit beneath as the fallback (the unlayered theme
  // `:root` out-ranks them). `siteSettings` feeds `generateMetadata` (title/description) here; its
  // `pageThemes` seeds the pages' themes (see the site pages).
  return (
    // `suppressHydrationWarning` (one level, `<html>` only): the inline scheme script below
    // may set `color-scheme` on <html> before React hydrates, an attribute the server markup
    // doesn't carry — without this, React flags that one expected mismatch. The script only
    // ever touches this element's attribute, so the suppression is scoped exactly to it.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistMono.variable} ${FONT_FACES["newsreader"].variable} ${instrumentSans.variable}`}
    >
      <body>
        {/* Flash-free scheme: apply the persisted light/dark override before first paint.
            First child of <body> so it runs during parse, ahead of any painted content;
            "system"/no-override do nothing (the CSS `light dark` default already follows the
            OS). See `@/lib/scheme`. */}
        <script dangerouslySetInnerHTML={{ __html: SCHEME_INIT_SCRIPT }} />
        {/* First focusable in the document — lets a keyboard user bypass the shell nav and jump
            to the page's `<main id="main-content">` (Page primitive), per WCAG 2.4.1. */}
        <SkipLink />
        <SiteNav />
        {children}
        <SiteFooter />
        {/* Reveals the native scrollbar thumb only while the document is scrolling (client leaf,
            renders nothing). */}
        <ScrollActivity />
        {/* Drives the auto-hiding sticky header: stamps scroll direction/position state on
            <html>; SiteNav's module does the visuals (client leaf, renders nothing). */}
        <NavVisibility />
        {/* Opens the Sanity Live EventSource so pages revalidate on content changes. Renders for
            every visitor (published live updates); streams drafts only with a browser token. Its
            own async island so the draftMode() read stays out of the sync RootLayout root. */}
        <SanityLiveMount />
        {/* Self-gates on Draft Mode — renders nothing for public visitors. Mounted once near
            the root per the bundled draft-mode doc. */}
        <VisualEditingControls />
      </body>
    </html>
  );
}
