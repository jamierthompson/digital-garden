import { connection } from "next/server";

import styles from "./ModuleShell.module.css";

// A deliberately DYNAMIC subtree that streams at request time. `await connection()` opts
// this component out of prerendering (§ Cache Components) — which is exactly why the page
// must wrap it in `<Suspense>` (uncached data outside Suspense is a build-time hard error
// `[D11]`). Its only job in the skeleton: force the route to actually STREAM, so we can
// prove the themed `<style>` is already in the shell `<head>` before this hole paints —
// i.e. flush-before-paint, no FOUC `[D13]`.
export default async function StreamedSection() {
  await connection();
  return (
    <p className={styles.streamed}>
      Streamed at request time — the brand theme above was already painted from
      the static shell before this dynamic hole arrived.
    </p>
  );
}
