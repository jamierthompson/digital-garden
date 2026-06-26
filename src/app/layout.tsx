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

// Binding import (no CSS side-effect) → does not move the Turbopack stylesheet anchor that
// the LOAD-BEARING block above pins, so it sits safely after the global sheets [D27, D12].
import { Suspense } from "react";
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

// The shell's themed subtree, extracted into its own async component for ONE reason: so the
// `siteSettings` read can live behind the `<Suspense>` boundary in `RootLayout` below. [D11, D16]
async function ShellTheme({ children }: { children: React.ReactNode }) {
  // `sanityFetch` caches the published shell brand into the static HTML (the flash-free theme
  // has to be in the initial bytes, [D11]) and serves fresh `siteSettings` drafts under Draft
  // Mode, so an edited shell title/brand previews like any other content. Same cache key as
  // `generateMetadata`'s call, so the read is deduped to one fetch.
  const settings = await sanityFetch(SITE_SETTINGS_QUERY);

  // Feed the shell scope its brand seed. ProjectScope/resolveScope is TOTAL and never throws
  // [D9]: a missing `siteSettings`, a bad `brandColor`, or an unknown `fontKey` each degrade to
  // the engine fallback palette + shell mono face. `slug="garden"` keys the shell island [§3.1].
  const scopeSeed = {
    slug: "garden",
    brandColor: settings?.brandColor ?? "",
    fontKey: settings?.fontKey ?? "",
  };

  return (
    <ProjectScopeBoundary>
      <ProjectScope seed={scopeSeed}>
        <ShellNav />
        {children}
      </ProjectScope>
    </ProjectScopeBoundary>
  );
}

// The Suspense fallback. It deliberately renders NO `<ProjectScope>`: the real `ShellTheme` and a
// themed fallback would BOTH emit `<style href="project-theme-garden">`, and React 19 de-dupes
// hoisted stylesheets by href keeping the FIRST committed — the fallback. During prerender React
// hoists the fallback's `<style>` even though the resolved `ShellTheme` is what ends up in the served
// body, so a themed fallback silently themes the whole shell with the engine fallback palette on BOTH
// the published static build and draft Preview (the Item C regression QA caught). Unthemed-but-
// structural (boundary + nav + content) keeps the layout stable; brand vars resolve when `ShellTheme`
// streams in. The brief unbranded fallback frame is a `next dev`-only artifact — a production build
// serves the build-time-resolved themed shell in the initial bytes (zero unbranded frames, draft
// included), symmetric with every project island (verified: docs/sessions/2026-06-26-shell-sourcing-
// islands/). MUST stay free of `<ProjectScope>` (pinned by layout.shell-theme-dedup.qa.test.tsx). [D9, D11]
function ShellThemeFallback({ children }: { children: React.ReactNode }) {
  return (
    <ProjectScopeBoundary>
      <ShellNav />
      {children}
    </ProjectScopeBoundary>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* LOAD-BEARING <Suspense> — do NOT remove, and do NOT render `<ProjectScope>` in the
            fallback (see `ShellThemeFallback`). [D11, D16, D27]
            `ShellTheme` is an async island: it awaits `sanityFetch(SITE_SETTINGS_QUERY)`. Under
            Cache Components, Draft Mode bypasses `use cache`, so that read re-executes uncached per
            request (use-cache.md §"Draft Mode") — request-time data in the body. This boundary is
            what lets it defer: the published cached read completes at prerender (the resolved
            real-brand tree is served statically); the draft read suspends and streams behind the
            fallback. Remove the boundary and the async body read trips `Uncached data … outside of
            <Suspense>` (the blocking-route error) — verified: it surfaces live in `next dev`; a
            production build prerendered the cached read so prod tolerates it, but the shape is wrong.
            NOTE: this boundary does NOT license `generateMetadata` — that read is `use cache` (cached
            at build, dynamic under draft) and is independently legal (Control C: a synchronous body +
            no boundary → metadata does NOT throw). CAVEAT: if you remove this boundary while
            `ShellTheme` is still async, `next dev` WILL log a blocking-route error whose stack frame
            points at `generateMetadata` (~line 42) — but that's the un-deferred async body making the
            whole route blocking, not metadata itself. Restore the boundary; don't "fix" metadata.
            (spike: docs/sessions/2026-06-26-shell-sourcing-islands/spike-findings.md) */}
        <Suspense
          fallback={<ShellThemeFallback>{children}</ShellThemeFallback>}
        >
          <ShellTheme>{children}</ShellTheme>
        </Suspense>
        {/* Self-gates on Draft Mode — renders nothing for public visitors. Mounted once near
            the root per the bundled draft-mode doc. */}
        <VisualEditingControls />
      </body>
    </html>
  );
}
