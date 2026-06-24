import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { Geist, Geist_Mono } from "next/font/google";

import ProjectScope from "@/components/project-scope/ProjectScope";
import ProjectScopeBoundary from "@/components/project-scope/ProjectScopeBoundary";
import ShellNav from "@/components/shell/ShellNav";
import { client } from "@/sanity/lib/client";
import { SITE_SETTINGS_QUERY } from "@/sanity/lib/queries";
import VisualEditingControls from "@/sanity/VisualEditingControls";

import "./foundation.css";
import "./globals.css";

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

/**
 * The shell island's brand seed. [§3.1, §6, D11]
 *
 * Cached with `use cache` because Cache Components is ON app-wide: uncached data
 * fetched outside `<Suspense>` is a build-time hard error, so the root layout's
 * `siteSettings` read MUST be cached or wrapped. We cache it (the shell brand is
 * stable, published content) and pin a long lifetime so it prerenders into the
 * static shell — the flash-free theme has to be in the initial HTML.
 * (node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md
 * — "use cache is designed primarily to include uncached data in the static
 * shell"; cacheLife('max') per …/02-guides/migrating-to-cache-components.md.)
 *
 * Reads through the PUBLIC `client` (published, CDN, no token, stega off) — the
 * draft path is handled separately by `<VisualEditingControls/>`, which self-gates
 * on Draft Mode and re-renders dynamically. `use cache` forbids runtime APIs like
 * `draftMode()`, so this stays purely on the published path by design. Returns a
 * serializable plain object (the query result), never a class instance.
 */
async function getSiteSettings() {
  "use cache";
  cacheLife("max");
  return client.fetch(SITE_SETTINGS_QUERY);
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
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
  const settings = await getSiteSettings();

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
