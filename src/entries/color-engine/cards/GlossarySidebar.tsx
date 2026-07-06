// The glossary sidebar (#154) — the shared vocabulary defined ONCE for the whole card grid,
// instead of a "what do these terms mean?" panel repeated on every card. Small, muted, and
// friendly (the editorial aside voice), it sits alongside the cards so a term is a glance away
// without cluttering each card. Presentational; the definitions are pure data in `glossary.ts`.
//
// Small muted text still clears AA: `--text-muted` is the engine's contrast-solved muted role
// (4.5:1 + Lc 60 against the worst-case surface), so "muted" here is quiet, not failing.

import { memo } from "react";

import { GLOSSARY } from "./glossary";
import styles from "./GlossarySidebar.module.css";

function GlossarySidebar(): React.ReactElement {
  return (
    <aside className={styles.sidebar} aria-label="Glossary — the words we use">
      <dl className={styles.terms}>
        {GLOSSARY.map((entry) => (
          <div key={entry.term}>
            <dt>{entry.term}</dt>
            <dd>{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

// Static content — memoize so it doesn't re-render on every seed/scheme change of the Color Engine.
export default memo(GlossarySidebar);
