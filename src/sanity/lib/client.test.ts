import { beforeAll, describe, expect, it } from "vitest";

/**
 * The public client is a correctness boundary, not a style choice: it must stay
 * published-only and CDN-backed (no drafts ever leak to public renders) and emit clean
 * strings (stega disabled — it never carries a token or powers Visual Editing).
 * `.config()` reflects what `createClient` was actually given, so we assert the wiring
 * rather than trusting the literals not to drift.
 *
 * The draft/Live read path is no longer a second client here — `defineLive` (`./live.ts`)
 * owns the published-vs-drafts branch, the per-request token, and stega. Those concerns
 * are covered by `live.test.ts`.
 *
 * `client.ts` pulls in `env.ts`, which `throw`s on missing public Sanity vars at import
 * time. The test runner provides no `.env`, so we stub the three PUBLIC vars (never the
 * secret token) and `import()` the module lazily after they're set.
 */
type Clients = typeof import("./client");
let client: Clients["client"];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??= "test-project";
  process.env.NEXT_PUBLIC_SANITY_DATASET ??= "test-dataset";
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ??= "2026-06-21";
  ({ client } = await import("./client"));
});

describe("public sanity client", () => {
  it("is published-only and CDN-backed", () => {
    const config = client.config();
    expect(config.useCdn).toBe(true);
    expect(config.perspective).toBe("published");
  });

  it("ships stega disabled (clean strings for public renders)", () => {
    expect(client.config().stega?.enabled).toBe(false);
  });

  it("carries no baked-in token (the public path is unauthenticated)", () => {
    // The secret must never be a module-level constant that could be bundled; the
    // draft token is attached per request by defineLive / the enable handshake.
    expect(client.config().token).toBeUndefined();
  });
});
