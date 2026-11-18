import { NextRequest } from "next/server";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Db } from "@/server/db/client";
import { memberId } from "@/server/seed/profiles";
import { VIEWER_COOKIE } from "@/server/viewer-cookie";
import {
  admirersOf,
  clearViewers,
  createTestDb,
  nonAdmirerOf,
} from "../helpers/db";

const holder = vi.hoisted(() => ({
  db: undefined as Promise<unknown> | undefined,
}));

// connection() only works inside a real Next.js request, so stub it here.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

// Route handlers call getDb(); point it at the in-memory test database.
vi.mock("@/server/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/client")>();
  return { ...actual, getDb: () => holder.db };
});

import { GET as cleanup } from "@/app/api/cron/cleanup/route";
import { POST as reset } from "@/app/api/demo/reset/route";
import { GET as feed } from "@/app/api/feed/route";
import { GET as health } from "@/app/api/health/route";
import { GET as listMatches } from "@/app/api/matches/route";
import { POST as swipe } from "@/app/api/swipe/route";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = Promise.resolve(db);
});
beforeEach(async () => {
  await clearViewers(db);
});

function request(
  path: string,
  {
    method = "GET",
    cookie,
    body,
    headers = {},
  }: {
    method?: string;
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie: `${VIEWER_COOKIE}=${cookie}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

/** Creates a viewer by calling the API once, as a browser would. */
async function newVisitor() {
  const response = await feed(request("/api/feed"));
  const id = response.cookies.get(VIEWER_COOKIE)!.value;
  return id;
}

describe("viewer cookie", () => {
  it("issues an HttpOnly, SameSite=Lax cookie on first contact", async () => {
    const response = await feed(request("/api/feed"));
    const cookie = response.cookies.get(VIEWER_COOKIE);
    expect(cookie?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
  });

  it("marks the cookie Secure only on HTTPS requests", async () => {
    const plain = await feed(request("/api/feed"));
    expect(plain.headers.get("set-cookie")).not.toMatch(/Secure/i);
    const secure = await feed(
      request("/api/feed", { headers: { "x-forwarded-proto": "https" } }),
    );
    expect(secure.headers.get("set-cookie")).toMatch(/Secure/i);
  });

  it("does not reissue a valid cookie", async () => {
    const id = await newVisitor();
    const response = await feed(request("/api/feed", { cookie: id }));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("replaces a malformed cookie", async () => {
    const response = await feed(request("/api/feed", { cookie: "not-a-uuid" }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(VIEWER_COOKIE)?.value).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it("will not let a forged cookie act as a seeded member", async () => {
    const response = await feed(request("/api/feed", { cookie: memberId(1) }));
    expect(response.status).toBe(200);
    const issued = response.cookies.get(VIEWER_COOKIE)?.value;
    expect(issued).toBeDefined();
    expect(issued).not.toBe(memberId(1));
  });

  it("sends Cache-Control: no-store on every response", async () => {
    const id = await newVisitor();
    for (const response of [
      await feed(request("/api/feed", { cookie: id })),
      await listMatches(request("/api/matches", { cookie: id })),
      await swipe(
        request("/api/swipe", { method: "POST", cookie: id, body: {} }),
      ),
    ]) {
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("GET /feed", () => {
  it("returns public profiles and a hasMore flag", async () => {
    const body = await (await feed(request("/api/feed"))).json();
    expect(body.profiles).toHaveLength(10);
    expect(body.hasMore).toBe(true);
    expect(Object.keys(body.profiles[0]).sort()).toEqual([
      "age",
      "bio",
      "id",
      "interests",
      "location",
      "name",
      "photoUrl",
    ]);
  });

  it("honours ?limit", async () => {
    const body = await (await feed(request("/api/feed?limit=3"))).json();
    expect(body.profiles).toHaveLength(3);
  });

  it.each(["0", "31", "-1", "abc", "2.5"])(
    "rejects limit=%s",
    async (limit) => {
      const response = await feed(request(`/api/feed?limit=${limit}`));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    },
  );
});

describe("POST /swipe", () => {
  it("records a pass and answers { matched: false }", async () => {
    const id = await newVisitor();
    const [admirer] = await admirersOf(db, id);
    const response = await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: admirer, action: "pass" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ matched: false });
  });

  it("answers a pass on an admirer byte-for-byte like a pass on a stranger", async () => {
    const id = await newVisitor();
    const [admirer] = await admirersOf(db, id);
    const stranger = await nonAdmirerOf(db, id);
    const post = (profileId: string) =>
      swipe(
        request("/api/swipe", {
          method: "POST",
          cookie: id,
          body: { profileId, action: "pass" },
        }),
      );

    const a = await post(admirer);
    const s = await post(stranger);
    expect(await a.text()).toBe(await s.text());
  });

  it("creates a match when the like is mutual", async () => {
    const id = await newVisitor();
    const [admirer] = await admirersOf(db, id);
    const response = await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: admirer, action: "like" },
      }),
    );
    const body = await response.json();
    expect(body.matched).toBe(true);
    expect(body.match.profile.id).toBe(admirer);
  });

  it("answers { matched: false } for a like nobody returned", async () => {
    const id = await newVisitor();
    const stranger = await nonAdmirerOf(db, id);
    const response = await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: stranger, action: "like" },
      }),
    );
    expect(await response.json()).toEqual({ matched: false });
  });

  it("rejects a repeated swipe with 409", async () => {
    const id = await newVisitor();
    const [target] = await admirersOf(db, id);
    const body = { profileId: target, action: "pass" };
    await swipe(request("/api/swipe", { method: "POST", cookie: id, body }));
    const again = await swipe(
      request("/api/swipe", { method: "POST", cookie: id, body }),
    );
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("ALREADY_SWIPED");
  });

  it("404s for an unknown profile", async () => {
    const id = await newVisitor();
    const response = await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: memberId(9999), action: "like" },
      }),
    );
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("PROFILE_NOT_FOUND");
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an empty body", {}],
    ["a missing action", { profileId: memberId(1) }],
    ["an unknown action", { profileId: memberId(1), action: "superlike" }],
    ["a non-UUID profileId", { profileId: "123", action: "like" }],
    [
      "unexpected extra fields",
      { profileId: memberId(1), action: "like", admin: true },
    ],
  ])("400s for %s", async (_label, body) => {
    const id = await newVisitor();
    const response = await swipe(
      request("/api/swipe", { method: "POST", cookie: id, body }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("never leaks internals in an error body", async () => {
    const id = await newVisitor();
    const response = await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: memberId(9999), action: "like" },
      }),
    );
    const text = await response.text();
    expect(Object.keys(JSON.parse(text))).toEqual(["error"]);
    expect(text).not.toMatch(/select|insert|stack|at \w+ \(/i);
  });
});

describe("GET /matches", () => {
  it("is empty until a mutual like happens", async () => {
    const id = await newVisitor();
    const body = await (
      await listMatches(request("/api/matches", { cookie: id }))
    ).json();
    expect(body).toEqual({ matches: [] });
  });

  it("lists mutual matches and persists them across requests", async () => {
    const id = await newVisitor();
    const [admirer] = await admirersOf(db, id);
    await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: admirer, action: "like" },
      }),
    );

    for (let i = 0; i < 2; i++) {
      const body = await (
        await listMatches(request("/api/matches", { cookie: id }))
      ).json();
      expect(body.matches).toHaveLength(1);
      expect(body.matches[0].profile.id).toBe(admirer);
    }
  });
});

describe("POST /api/demo/reset", () => {
  it("gives the visitor a fresh deck and no matches", async () => {
    const id = await newVisitor();
    const [admirer] = await admirersOf(db, id);
    await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: id,
        body: { profileId: admirer, action: "like" },
      }),
    );

    const response = await reset(
      request("/api/demo/reset", { method: "POST", cookie: id }),
    );
    expect(response.status).toBe(200);

    const matches = await (
      await listMatches(request("/api/matches", { cookie: id }))
    ).json();
    expect(matches.matches).toEqual([]);
    const deck = await (
      await feed(request("/api/feed?limit=30", { cookie: id }))
    ).json();
    expect(deck.hasMore).toBe(true);
  });
});

describe("GET /api/cron/cleanup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await cleanup(
      request("/api/cron/cleanup", { headers: { authorization: "Bearer " } }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a missing or wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await cleanup(request("/api/cron/cleanup"))).status).toBe(401);
    const wrong = await cleanup(
      request("/api/cron/cleanup", {
        headers: { authorization: "Bearer nope" },
      }),
    );
    expect(wrong.status).toBe(401);
  });

  it("runs with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const response = await cleanup(
      request("/api/cron/cleanup", {
        headers: { authorization: "Bearer s3cret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: 0 });
  });
});

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("visitor isolation over HTTP", () => {
  it("keeps two visitors' decks and matches separate", async () => {
    const [a, b] = [await newVisitor(), await newVisitor()];
    expect(a).not.toBe(b);
    const [admirerOfA] = await admirersOf(db, a);
    await swipe(
      request("/api/swipe", {
        method: "POST",
        cookie: a,
        body: { profileId: admirerOfA, action: "like" },
      }),
    );

    const bMatches = await (
      await listMatches(request("/api/matches", { cookie: b }))
    ).json();
    expect(bMatches.matches).toEqual([]);
  });
});
