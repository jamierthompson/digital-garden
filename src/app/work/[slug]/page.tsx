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
// stub scope falls back safely rather than 404 — exercising the no-throw path `[D9]`.
export function generateStaticParams(): Array<{ slug: string }> {
  return [{ slug: "oklch-engine" }];
}

export default async function WorkPage({ params }: WorkPageProps) {
  // Request API is async under Next 16 — `params` is a Promise, awaited here.
  const { slug } = await params;
  return (
    <ProjectScopeBoundary>
      <ProjectScope seed={{ slug }}>
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
