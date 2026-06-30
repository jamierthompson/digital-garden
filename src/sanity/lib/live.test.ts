import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `live.ts` wires `defineLive`. We do NOT exercise the library's fetch machinery here
 * (that's Next/Cache-Components runtime, not jsdom); we assert OUR wiring is
 * correct, because every read inherits it:
 *  - the base client carries the stega `studioUrl` + the exclusion filter (so
 *    drafts get click-to-edit while code-consumed fields stay clean), and NO token;
 *  - `serverToken`/`browserToken` come from the right env vars (server vs. browser);
 *  - `strict: true` (forces explicit perspective/stega/includeDrafts — see live.ts).
 *
 * `defineLive` is mocked to a spy so importing `live.ts` doesn't pull the Cache-
 * Components runtime; `createClient` stays REAL so we inspect the actual client config.
 */
type DefineLiveConfig = {
  client: import("next-sanity").SanityClient;
  serverToken?: string | false;
  browserToken?: string | false;
  strict?: boolean;
};

const { defineLiveSpy } = vi.hoisted(() => ({
  defineLiveSpy: vi.fn(() => ({
    sanityFetch: vi.fn(),
    SanityLive: () => null,
  })),
}));

vi.mock("next-sanity/live", () => ({ defineLive: defineLiveSpy }));

const SERVER_TOKEN = "server-read-token";
const BROWSER_TOKEN = "browser-viewer-token";
const STUDIO_URL = "https://studio.example.test";

const saved: Record<string, string | undefined> = {};
const setEnv = (k: string, v: string) => {
  saved[k] = process.env[k];
  process.env[k] = v;
};

let config: DefineLiveConfig;

beforeAll(async () => {
  setEnv("NEXT_PUBLIC_SANITY_PROJECT_ID", "test-project");
  setEnv("NEXT_PUBLIC_SANITY_DATASET", "test-dataset");
  setEnv("NEXT_PUBLIC_SANITY_API_VERSION", "2026-06-21");
  setEnv("NEXT_PUBLIC_SANITY_STUDIO_URL", STUDIO_URL);
  setEnv("SANITY_API_READ_TOKEN", SERVER_TOKEN);
  setEnv("SANITY_API_BROWSER_TOKEN", BROWSER_TOKEN);

  await import("./live");
  config = (defineLiveSpy.mock.calls as unknown as DefineLiveConfig[][])[0][0];
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("defineLive wiring", () => {
  it("passes the server-only read token as serverToken", () => {
    expect(config.serverToken).toBe(SERVER_TOKEN);
  });

  it("passes the dedicated browser token as browserToken (separate var)", () => {
    expect(config.browserToken).toBe(BROWSER_TOKEN);
  });

  it("runs strict so every call site must pass perspective/stega/includeDrafts", () => {
    expect(config.strict).toBe(true);
  });
});

describe("the Live base client", () => {
  it("carries the stega studioUrl so draft encoding can link back to the Studio", () => {
    expect(config.client.config().stega?.studioUrl).toBe(STUDIO_URL);
  });

  it("installs the exclusion filter — code-consumed fields skip stega", () => {
    const filter = config.client.config().stega?.filter;
    expect(filter).toBeTypeOf("function");
    const skip = filter!({
      sourcePath: ["brandColor"],
      filterDefault: () => true,
    } as unknown as Parameters<NonNullable<typeof filter>>[0]);
    expect(skip).toBe(false);
  });

  it("bakes in NO token — the secret is attached per request by defineLive", () => {
    expect(config.client.config().token).toBeUndefined();
  });
});
