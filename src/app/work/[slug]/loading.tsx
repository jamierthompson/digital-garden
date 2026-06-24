import styles from "./states.module.css";

// The loading boundary for `/work/<slug>` [D19]. Shown while the route's dynamic holes
// stream in under PPR. Loading components take no props
// (`node_modules/.../03-file-conventions/loading.md`). Kept deliberately minimal — the
// themed shell paints from the static HTML; this is only the transient hole filler.
export default function WorkLoading() {
  return (
    <main className={styles.state} aria-busy="true">
      <p className={styles.body}>Loading project…</p>
    </main>
  );
}
