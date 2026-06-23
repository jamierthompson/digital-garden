"use client";

import { unstable_catchError } from "next/error";
import type { ReactNode } from "react";

// The last-resort backstop around `ProjectScope` `[D9]`. `unstable_catchError`
// (`next/error`, introduced v16.2.0) builds a component-level error boundary — the
// correct containment here because a segment `error.tsx` does NOT catch a throw from its
// own layout, and `ProjectScope` wraps content at layout level (§7). The fallback module
// must be a Client Component, hence `'use client'`.
//
// In practice this should never fire: `resolveScope` is total and never throws, so the
// PRIMARY defense is the defensive resolver. This boundary only catches an unforeseen
// throw (e.g. a future engine bug) and degrades to a neutral, unthemed notice rather than
// taking the page down. The fallback cannot re-render `children` (the API omits them by
// design), so the never-throw resolver — not this boundary — is what keeps content
// visible in the normal case.

// No configurable props today. `Record<never, never>` (not `Record<string, never>` or a
// `{}` literal) is deliberate: it carries no string index signature, so intersecting with
// the wrapper's `{ children }` does not collapse `children` to `never`.
type ScopeFallbackProps = Record<never, never>;

function ScopeErrorFallback(): ReactNode {
  return (
    <div data-project="fallback" role="alert">
      <p>Theme unavailable — showing the default appearance.</p>
    </div>
  );
}

const ProjectScopeBoundary =
  unstable_catchError<ScopeFallbackProps>(ScopeErrorFallback);

export default ProjectScopeBoundary;
