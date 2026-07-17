import Page from "@/components/layout/Page";

import styles from "./loading.module.css";

// The root loading boundary — the Suspense boundary for every segment that doesn't
// declare its own (`/`, `/browse`, `/now`, …; `/[slug]` keeps its specific one). Its job
// is structural (#135): `sanityFetch` is `use cache`, so PUBLIC requests prerender into
// the static shell and never see this — but Draft Mode re-executes cached functions per
// request (use-cache.md), and without a boundary those routes block whole-page. With it,
// the shell streams and this transient filler shows only to draft-mode editors (and dev).
// Loading components take no props (`node_modules/.../03-file-conventions/loading.md`).
export default function RootLoading() {
  return (
    <Page className={styles.state} aria-busy="true">
      <p className={styles.body}>Loading…</p>
    </Page>
  );
}
