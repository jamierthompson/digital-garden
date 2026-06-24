import { Suspense } from "react";

import ProjectScope from "@/components/project-scope/ProjectScope";
import ProjectScopeBoundary from "@/components/project-scope/ProjectScopeBoundary";

import ModuleShell from "./ModuleShell";
import styles from "./page.module.css";
import StreamedSection from "./StreamedSection";

// Thin route (`app/` is routing only — it mounts components from `src/`). The composition:
//   ProjectScopeBoundary (unstable_catchError backstop, client)  [D9]
//     └ ProjectScope (stub keystone — emits the scoped @layer brand <style>)  [D12,D13]
//         └ ModuleShell (hardcoded, token-consuming presentation)
//             └ <Suspense> → StreamedSection (forces a streamed dynamic hole)  [D11,D13]
interface WorkPageProps {
  params: Promise<{ slug: string }>;
}

// Prerender the one known skeleton slug so `pnpm build` emits a static shell to inspect
// for the empirical `<head>` font-preload check `[D11]`. Unknown slugs still render — the
// scope falls back safely rather than 404 — exercising the no-throw path `[D9]`.
export function generateStaticParams(): Array<{ slug: string }> {
  return [{ slug: "oklch-engine" }];
}

// Sanity is not wired to this route until Phase 3, so the skeleton slug's brand color +
// font are hardcoded here. `brandColor` is a real, engine-parseable `oklch()` literal (a
// blue, matching the old stub hue); `fontKey` is a real roster key. Phase 3 sources both
// from the project document. An unknown slug carries this same seed but renders under the
// vetted `fallback` selector — the no-throw path `[D9]`.
const SKELETON_SEED = {
  brandColor: "oklch(0.62 0.21 264)",
  fontKey: "jetbrains-mono",
} as const;

export default async function WorkPage({ params }: WorkPageProps) {
  // Request API is async under Next 16 — `params` is a Promise, awaited here.
  const { slug } = await params;
  return (
    <ProjectScopeBoundary>
      <ProjectScope seed={{ slug, ...SKELETON_SEED }}>
        <ModuleShell slug={slug}>
          <Suspense
            fallback={
              <p className={styles.skeleton}>Loading dynamic section…</p>
            }
          >
            <StreamedSection />
          </Suspense>
        </ModuleShell>
      </ProjectScope>
    </ProjectScopeBoundary>
  );
}
