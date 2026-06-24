import { beforeAll, describe, expect, it } from "vitest";

/**
 * The two clients are a correctness boundary, not a style choice [D16]: the
 * public client must stay published-only and CDN-backed (no drafts ever leak to
 * public renders), and the draft client must be live (no CDN) on the drafts
 * perspective. `.config()` reflects what `createClient` was actually given, so we
 * assert the wiring rather than trusting the literals not to drift.
 *
 * `client.ts` pulls in `env.ts`, which `throw`s on missing public Sanity vars at
 * import time. The test runner provides no `.env`, so we stub the three PUBLIC
 * vars (never the secret token) and `import()` the module lazily after they're set.
 */
type Clients = typeof import("./client");
let client: Clients["client"];
let draftClient: Clients["draftClient"];

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??= "test-project";
  process.env.NEXT_PUBLIC_SANITY_DATASET ??= "test-dataset";
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ??= "2026-06-21";
  ({ client, draftClient } = await import("./client"));
});

describe("sanity clients", () => {
  it("public client is published-only and CDN-backed", () => {
    const config = client.config();
    expect(config.useCdn).toBe(true);
    expect(config.perspective).toBe("published");
  });

  it("public client ships stega disabled (clean strings for public renders)", () => {
    expect(client.config().stega?.enabled).toBe(false);
  });

  it("draft client is live (no CDN) on the drafts perspective", () => {
    const config = draftClient.config();
    expect(config.useCdn).toBe(false);
    expect(config.perspective).toBe("drafts");
  });

  it("draft client enables stega for Visual Editing click-to-edit", () => {
    expect(draftClient.config().stega?.enabled).toBe(true);
  });

  it("draft client carries no baked-in token (token is attached per request)", () => {
    // The secret must never be a module-level constant that could be bundled; it
    // is attached via `.withConfig({ token })` in the route handler / getClient.
    expect(draftClient.config().token).toBeUndefined();
  });
});
