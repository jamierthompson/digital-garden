import type { Metadata } from "next";

// LOAD-BEARING IMPORT ORDER — do not reorder, and do not enable an import-sorter
// that would [D27, D12]. These global sheets establish the cascade-layer order
// (`@layer foundation, brand, project;` lives in foundation.css) and MUST be imported
// before `next/font` and every component below. Turbopack anchors the route's FIRST
// emitted stylesheet to whatever is imported first; if a `next/font`/component-module
// chunk lands first it registers `@layer project` as the LOWEST layer, so the
// foundation reset out-ranks every project rule and zeroes their padding/margin (the
// cascade inversion). Pinned by layout.import-order.test.ts.
import "./foundation.css";
import "./globals.css";

import { Geist, Geist_Mono } from "next/font/google";

import ProjectScope from "@/components/project-scope/ProjectScope";
import ProjectScopeBoundary from "@/components/project-scope/ProjectScopeBoundary";
import ShellNav from "@/components/shell/ShellNav";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";
import { sanityFetch } from "@/sanity/lib/sanityFetch";
import VisualEditingControls from "@/sanity/VisualEditingControls";

// The shell's own faces — the only fonts preloaded on every route (D11).
// Per-project (and shell-brand) faces load on demand via the Phase 1 roster with
// preload: false; the resolved shell face's `.variable` is mounted by ProjectScope.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: true,
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `sanityFetch` caches the published shell brand into the static HTML (the flash-free
  // theme has to be in the initial bytes, [D11]) and serves fresh `siteSettings` drafts
  // under Draft Mode, so an edited shell title/brand previews like any other content.
  // Same cache key as `generateMetadata`'s call, so the read is deduped to one fetch.
  const settings = await sanityFetch(SITE_SETTINGS_QUERY);

  // Feed the shell scope its brand seed. ProjectScope/resolveScope is TOTAL and never
  // throws [D9]: a missing `siteSettings`, a bad `brandColor`, or an unknown `fontKey`
  // each degrade to the engine fallback palette + shell mono face. `slug="garden"`
  // keys the shell island [§3.1] (Core registers "garden" in the allowed-slug set
  // during integration; until then it safely collapses to the fallback selector).
  const scopeSeed = {
    slug: "garden",
    brandColor: settings?.brandColor ?? "",
    fontKey: settings?.fontKey ?? "",
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ProjectScopeBoundary>
          <ProjectScope seed={scopeSeed}>
            <ShellNav />
            {children}
          </ProjectScope>
        </ProjectScopeBoundary>
        {/* Self-gates on Draft Mode — renders nothing for public visitors. Mounted
            once near the root per the bundled draft-mode doc. */}
        <VisualEditingControls />
      </body>
    </html>
  );
}
