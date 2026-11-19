import { expect, test } from "./fixtures";

/**
 * Black-box tests against the real running server: malformed and hostile
 * requests must be refused cleanly (never a 5xx, never a crash), and the
 * privacy promise must hold over real HTTP.
 */

const MEMBER = "00000000-0000-4000-8000-000000000001";
const PUBLIC_KEYS = [
  "age",
  "bio",
  "id",
  "interests",
  "location",
  "name",
  "photoUrl",
];

test.describe("methods and routing", () => {
  for (const path of ["/feed", "/swipe", "/matches"]) {
    test(`${path}: unsupported methods are refused, not crashed`, async ({
      request,
    }) => {
      const wrong =
        path === "/swipe"
          ? ["GET", "PUT", "DELETE", "PATCH"]
          : ["POST", "PUT", "DELETE", "PATCH"];
      for (const method of wrong) {
        const response = await request.fetch(path, { method });
        expect(response.status(), `${method} ${path}`).toBe(405);
      }
      const options = await request.fetch(path, { method: "OPTIONS" });
      expect(options.status()).toBeLessThan(500);
    });
  }

  test("/feed, /api/feed, and /feed/ all behave", async ({ request }) => {
    const a = await request.get("/feed?limit=3");
    const b = await request.get("/api/feed?limit=3");
    expect(a.status()).toBe(200);
    expect(await a.text()).toBe(await b.text());
    const slash = await request.get("/feed/?limit=3");
    expect(slash.status()).toBeLessThan(500);
  });

  test("unknown routes give a clean 404 with security headers", async ({
    request,
  }) => {
    const response = await request.get("/definitely/not/here");
    expect(response.status()).toBe(404);
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });

  test("path tricks don't escape the app", async ({ request }) => {
    for (const path of [
      "/api/../package.json",
      "/%2e%2e/package.json",
      "/_next/../.env.local",
      "/..%2f..%2fetc/passwd",
      "/api/swipe%00",
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBeLessThan(500);
      const body = await response.text();
      expect(body).not.toMatch(/DATABASE_URL|"dependencies"|root:/);
    }
  });
});

test.describe("hostile request bodies", () => {
  test.beforeEach(async ({ request }) => {
    await request.get("/feed?limit=1"); // get a visitor cookie
  });

  const cases: [string, string | Buffer, string?][] = [
    ["empty body", ""],
    ["a bare number", "42"],
    ["null", "null"],
    ["an array", "[]"],
    ["a string", '"hello"'],
    ["truncated JSON", '{"profileId": "'],
    ["trailing comma", `{"profileId":"${MEMBER}","action":"like",}`],
    ["a UTF-8 BOM", `﻿{"profileId":"${MEMBER}","action":"like"}`],
    ["binary garbage", Buffer.from([0, 255, 254, 1, 2, 3, 128])],
    [
      "__proto__ pollution",
      `{"__proto__":{"admin":true},"profileId":"${MEMBER}","action":"like"}`,
    ],
    [
      "constructor pollution",
      `{"constructor":{"prototype":{"x":1}},"profileId":"${MEMBER}","action":"like"}`,
    ],
    [
      "SQL injection in profileId",
      `{"profileId":"'; DROP TABLE users;--","action":"like"}`,
    ],
    [
      "SQL injection in action",
      `{"profileId":"${MEMBER}","action":"like'; DROP TABLE swipes;--"}`,
    ],
    ["numeric profileId", `{"profileId":1,"action":"like"}`],
    ["object profileId", `{"profileId":{"$ne":null},"action":"like"}`],
    ["array profileId", `{"profileId":["${MEMBER}"],"action":"like"}`],
    ["boolean action", `{"profileId":"${MEMBER}","action":true}`],
    ["uppercase action", `{"profileId":"${MEMBER}","action":"LIKE"}`],
    ["whitespace action", `{"profileId":"${MEMBER}","action":" like"}`],
    ["extra fields", `{"profileId":"${MEMBER}","action":"like","extra":1}`],
    ["emoji and RTL junk", `{"profileId":"💘‮abc","action":"like"}`],
    [
      "very long profileId",
      `{"profileId":"${"a".repeat(200_000)}","action":"like"}`,
    ],
    ["deeply nested JSON", "[".repeat(5000) + "]".repeat(5000)],
    [
      "a huge body",
      `{"profileId":"${MEMBER}","action":"like","pad":"${"x".repeat(5_000_000)}"}`,
    ],
  ];

  for (const [label, body] of cases) {
    test(`POST /swipe with ${label} is refused cleanly`, async ({
      request,
    }) => {
      const response = await request.post("/swipe", {
        headers: { "content-type": "application/json" },
        data: body,
      });
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
      const text = await response.text();
      // A clean error envelope, with no internals.
      const parsed = JSON.parse(text);
      expect(Object.keys(parsed)).toEqual(["error"]);
      expect(text).not.toMatch(/select |insert |drizzle|node_modules|stack/i);
    });
  }

  test("a valid swipe still works after all of that (the server is alive)", async ({
    request,
  }) => {
    const response = await request.post("/swipe", {
      data: { profileId: MEMBER, action: "pass" },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ matched: false });
  });

  test("the wrong content-type is still handled", async ({ request }) => {
    for (const type of [
      "text/plain",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ]) {
      const response = await request.post("/swipe", {
        headers: { "content-type": type },
        data: `{"profileId":"${MEMBER}","action":"like"}`,
      });
      expect(response.status(), type).toBeLessThan(500);
    }
  });

  test("an uppercase UUID is accepted and treated as the same profile", async ({
    request,
  }) => {
    const first = await request.post("/swipe", {
      data: { profileId: MEMBER, action: "pass" },
    });
    expect(first.status()).toBe(200);
    // Same profile, different spelling: it is already swiped, not a new one.
    const again = await request.post("/swipe", {
      data: { profileId: MEMBER.toUpperCase(), action: "like" },
    });
    expect(again.status()).toBe(409);
  });
});

test.describe("hostile query strings", () => {
  const limits = [
    "",
    "0",
    "-1",
    "31",
    "1e1",
    "0x10",
    "1.5",
    "NaN",
    "Infinity",
    "%00",
    "%20%205",
    "5%20",
    "abc",
    "9".repeat(400),
    "1,2",
    "[]",
    "{}",
    "' OR 1=1--",
  ];
  for (const limit of limits) {
    test(`/feed?limit=${limit.slice(0, 20)} never 500s`, async ({
      request,
    }) => {
      const response = await request.get(`/feed?limit=${limit}`);
      expect([200, 400]).toContain(response.status());
    });
  }

  test("repeated and array-style params never 500", async ({ request }) => {
    for (const qs of [
      "limit=5&limit=7",
      "limit[]=5",
      "limit=5&x=" + "y".repeat(50_000),
      "a=b&limit=5&a=c",
    ]) {
      const response = await request.get(`/feed?${qs}`);
      expect(response.status(), qs).toBeLessThan(500);
    }
  });
});

test.describe("identity cookie", () => {
  test("garbage, oversized and spoofed cookies never 500", async ({
    playwright,
    baseURL,
  }) => {
    const garbage = [
      "x",
      "not-a-uuid",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      MEMBER, // a seeded member's id
      "{" + MEMBER + "}",
      MEMBER.toUpperCase(),
      "a".repeat(3000),
      "'; DROP TABLE users;--",
      "%00%00",
    ];
    for (const value of garbage) {
      const ctx = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { cookie: `coy_viewer=${value}` },
      });
      const response = await ctx.get("/feed?limit=2");
      expect(response.status(), value.slice(0, 30)).toBeLessThan(500);
      await ctx.dispose();
    }
  });

  test("a cookie naming a seeded member never acts as that member", async ({
    playwright,
    baseURL,
  }) => {
    const ctx = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { cookie: `coy_viewer=${MEMBER}` },
    });
    const response = await ctx.get("/matches");
    expect(response.status()).toBe(200);
    // A fresh, different identity was issued instead.
    const setCookie = response.headers()["set-cookie"] ?? "";
    expect(setCookie).toMatch(/coy_viewer=[0-9a-f-]{36}/);
    expect(setCookie).not.toContain(MEMBER);
    await ctx.dispose();
  });

  test("pages hand out one cookie, HttpOnly and SameSite, and don't reissue it", async ({
    playwright,
    baseURL,
  }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const first = await ctx.get("/discover");
    const cookie = first.headers()["set-cookie"];
    expect(cookie).toMatch(/coy_viewer=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const second = await ctx.get("/discover");
    expect(second.headers()["set-cookie"]).toBeUndefined();
    await ctx.dispose();
  });
});

test.describe("image proxy cannot be abused (SSRF)", () => {
  const bad = [
    "http://127.0.0.1:3200/api/health",
    "http://localhost:3200/api/health",
    "http://169.254.169.254/latest/meta-data/",
    "https://evil.example.com/a.png",
    "https://i.pravatar.cc/200?img=1", // right host, wrong path
    "//evil.example.com/a.png",
    "file:///etc/passwd",
    "https://i.pravatar.cc.evil.example.com/640?img=1",
  ];
  for (const url of bad) {
    test(`refuses ${url}`, async ({ request }) => {
      const response = await request.get(
        `/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`,
      );
      expect(response.status()).toBeGreaterThanOrEqual(400);
      expect(response.status()).toBeLessThan(500);
    });
  }
});

test.describe("security headers", () => {
  for (const path of [
    "/",
    "/discover",
    "/discover/matches",
    "/feed?limit=1",
    "/nope",
  ]) {
    test(`${path} carries the hardening headers`, async ({ request }) => {
      const headers = (await request.get(path)).headers();
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(headers["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(headers["content-security-policy"]).toContain("object-src 'none'");
      expect(headers["permissions-policy"]).toContain("camera=()");
      expect(headers["x-powered-by"]).toBeUndefined();
    });
  }

  test("API responses are never cacheable", async ({ request }) => {
    for (const path of ["/feed?limit=1", "/matches"]) {
      expect((await request.get(path)).headers()["cache-control"]).toBe(
        "no-store",
      );
    }
  });
});

test.describe("concurrency over real HTTP", () => {
  test("40 simultaneous swipes on one profile: exactly one succeeds", async ({
    request,
  }) => {
    await request.get("/feed?limit=1");
    const responses = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        request.post("/swipe", {
          data: { profileId: MEMBER, action: i % 2 ? "like" : "pass" },
        }),
      ),
    );
    const codes = responses.map((r) => r.status());
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(39);
  });

  test("30 simultaneous first visits each get their own identity", async ({
    playwright,
    baseURL,
  }) => {
    const results = await Promise.all(
      Array.from({ length: 30 }, async () => {
        const ctx = await playwright.request.newContext({ baseURL });
        const response = await ctx.get("/feed?limit=1");
        const id = /coy_viewer=([0-9a-f-]{36})/.exec(
          response.headers()["set-cookie"] ?? "",
        )?.[1];
        await ctx.dispose();
        return { status: response.status(), id };
      }),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.id)).size).toBe(30);
  });
});

test.describe("privacy over real HTTP, across many visitors", () => {
  test("nothing ever reveals who liked a visitor, and matches equal exactly the admirers liked", async ({
    playwright,
    baseURL,
  }) => {
    const LEAKY_KEYS =
      /liked_?you|likes_?you|has_?liked|admirer|secret_?crush|likedBy|likesMe/i;

    for (let visitor = 0; visitor < 8; visitor++) {
      const ctx = await playwright.request.newContext({ baseURL });
      const bodies: string[] = [];
      const grab = async (response: Awaited<ReturnType<typeof ctx.get>>) => {
        const text = await response.text();
        bodies.push(text);
        return JSON.parse(text);
      };

      await ctx.get("/discover");
      const myId = (await ctx.storageState()).cookies.find(
        (c) => c.name === "coy_viewer",
      )!.value;

      // Like everyone, page by page.
      let matched = 0;
      let swiped = 0;
      for (;;) {
        const feed = await grab(await ctx.get("/feed?limit=10"));
        for (const profile of feed.profiles) {
          expect(Object.keys(profile).sort()).toEqual(PUBLIC_KEYS);
          const result = await grab(
            await ctx.post("/swipe", {
              data: { profileId: profile.id, action: "like" },
            }),
          );
          swiped++;
          if (result.matched) matched++;
          expect(Object.keys(result).sort()).toEqual(
            result.matched ? ["match", "matched"] : ["matched"],
          );
        }
        if (!feed.hasMore) break;
      }
      const matches = await grab(await ctx.get("/matches"));
      expect(swiped).toBe(32);
      expect(matches.matches).toHaveLength(matched);
      expect(matched).toBeGreaterThanOrEqual(8);
      expect(matched).toBeLessThanOrEqual(10);

      const everything = bodies.join("\n");
      expect(everything).not.toMatch(LEAKY_KEYS);
      // A visitor's own id (their secret) must never be echoed back.
      expect(everything).not.toContain(myId);
      await ctx.dispose();
    }
  });
});
