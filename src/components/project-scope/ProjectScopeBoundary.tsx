"use client";

import { unstable_catchError } from "next/error";
import type { ReactNode } from "react";

// The last-resort backstop around `ProjectScope`. `unstable_catchError`
// (`next/error`) builds a component-level error boundary — the correct containment here
// because a segment `error.tsx` does NOT catch a throw from its own layout, and
// `ProjectScope` wraps content at layout level. The fallback must be a Client
// Component, hence `'use client'`.
//
// The PRIMARY defense is the never-throwing `resolveScope`; this only catches an unforeseen
// throw and degrades to a neutral, unthemed notice. The fallback cannot re-render `children`
// (the API omits them), so the resolver — not this boundary — keeps content visible normally.

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
