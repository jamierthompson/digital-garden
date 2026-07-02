import type { Metadata } from "next";

// LOAD-BEARING IMPORT ORDER — do not reorder, and do not enable an import-sorter.
// These global sheets establish the cascade-layer order (`@layer foundation, semantic, brand,
// project;` in foundation.css) and MUST be imported before `next/font` and every component below.
// Turbopack anchors the route's FIRST emitted stylesheet to whatever is imported first; if a
// `next/font`/component chunk lands first it registers `@layer project` as the LOWEST layer, so
// the foundation reset out-ranks every project rule and zeroes their padding/margin. Pinned by
// layout.import-order.test.ts.
import "./foundation.css";
import "./globals.css";

// Binding imports (no CSS side-effect that moves the Turbopack stylesheet anchor pinned above),
// so they sit safely after the global sheets.
import { Geist_Mono, Source_Serif_4 } from "next/font/google";

import ShellNav from "@/components/shell/ShellNav";
import { FONT_FACES } from "@/fonts/roster";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";
import SanityLiveMount from "@/sanity/SanityLiveMount";
import VisualEditingControls from "@/sanity/VisualEditingControls";

// The shell's own body face. Source Serif 4 is the GLOBAL EDITORIAL body font — the semantic
// `--font-face` default (foundation.css) maps to `var(--font-source-serif-4)`, so mounting its
// `.variable` on <html> brings that variable into scope for all chrome. Its size-adjusted
// fallback keeps CLS at zero. A project slot overrides `--font-face` with its own roster face.
// The shell's display face (Space Grotesk → `--font-display`, the `folio_` logo + nav) and
// mono face (JetBrains Mono → `--font-mono`, metadata/readouts) are ALSO in the per-project
// roster, so the shell reuses those roster `.variable`s (mounted below) rather than declaring
// duplicate loaders.
//
// `preload: false` matches the existing shell posture (accessibility-and-performance.md): the
// preload policy preloads only above-the-fold faces via a manual `<link>`, since `next/font`
// can't statically target a runtime-selected face — so no loader here flips preload on. (#38.)
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
  preload: false,
});

// Geist Mono is the project scope's shell-font FALLBACK (`--font-geist-mono`, used only when a
// project's `fontKey` doesn't resolve — see scopeSeed.ts). Kept mounted so that fallback
// resolves. Never above the fold on the shell routes, so `preload: false`. (Geist Sans was
// removed — nothing read `--font-geist-sans`, so its preload was pure waste competing with LCP.)
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
  // Editorial chrome is GLOBAL: the shell reads the semantic layer's editorial defaults
  // (foundation.css) — no `siteSettings`-seeded brand scope wraps the shell any more. A
  // project's brand color + font are scoped to its own interactive slot (see
  // `[slug]/page.tsx`), never the shell. `siteSettings` still feeds `generateMetadata`
  // (title/description); it no longer themes the chrome.
  return (
    <html
      lang="en"
      className={`${geistMono.variable} ${sourceSerif.variable} ${FONT_FACES["space-grotesk"].variable} ${FONT_FACES["jetbrains-mono"].variable}`}
    >
      <body>
        <ShellNav />
        {children}
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
