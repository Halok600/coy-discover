/**
 * Load and correctness test against a running instance.
 *
 *   npm run build && npm start
 *   BASE_URL=http://localhost:3000 VISITORS=100 CONCURRENCY=25 npm run loadtest
 *
 * Every virtual visitor loads the page, then likes the entire deck and reads
 * their matches. Besides latency, it checks that the answers stay correct
 * under pressure: a visitor must end up with exactly as many matches as they
 * have admirers, and every swipe must succeed.
 */
import { admirerCount } from "@/server/services/viewer";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const VISITORS = Number(process.env.VISITORS ?? 100);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 25);

const latencies = new Map<string, number[]>();
const problems: string[] = [];
let requests = 0;

async function timed(route: string, url: string, init?: RequestInit) {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    problems.push(`${route}: network error ${String(error)}`);
    throw error;
  }
  const body = await response.text();
  const ms = performance.now() - started;
  requests++;
  const list = latencies.get(route) ?? [];
  list.push(ms);
  latencies.set(route, list);
  if (response.status >= 500)
    problems.push(`${route}: HTTP ${response.status}`);
  return { response, body };
}

async function visitor(index: number) {
  const page = await timed("GET /discover", `${BASE_URL}/discover`);
  const cookie = /coy_viewer=([0-9a-f-]{36})/.exec(
    page.response.headers.get("set-cookie") ?? "",
  )?.[1];
  if (!cookie) {
    problems.push(`visitor ${index}: no cookie issued`);
    return;
  }
  const headers = {
    cookie: `coy_viewer=${cookie}`,
    "content-type": "application/json",
  };

  let swiped = 0;
  let matched = 0;
  for (;;) {
    const feed = await timed("GET /feed", `${BASE_URL}/feed?limit=10`, {
      headers,
    });
    const { profiles, hasMore } = JSON.parse(feed.body) as {
      profiles: { id: string }[];
      hasMore: boolean;
    };
    for (const { id } of profiles) {
      const swipe = await timed("POST /swipe", `${BASE_URL}/swipe`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          profileId: id,
          action: "like",
          note: `hello from visitor ${index}`,
        }),
      });
      if (swipe.response.status !== 200) {
        problems.push(
          `visitor ${index}: swipe -> ${swipe.response.status} ${swipe.body.slice(0, 80)}`,
        );
        continue;
      }
      swiped++;
      if ((JSON.parse(swipe.body) as { matched: boolean }).matched) matched++;
    }
    if (!hasMore) break;
  }

  const matches = JSON.parse(
    (await timed("GET /matches", `${BASE_URL}/matches`, { headers })).body,
  ) as {
    matches: { theirNote: string | null; yourNote: string | null }[];
  };

  for (const match of matches.matches) {
    if (!match.theirNote)
      problems.push(`visitor ${index}: a match without their note`);
    if (match.yourNote !== `hello from visitor ${index}`) {
      problems.push(
        `visitor ${index}: wrong note echoed back: ${match.yourNote}`,
      );
    }
  }
  if (swiped !== 32)
    problems.push(`visitor ${index}: swiped ${swiped}, expected 32`);
  if (matched !== admirerCount(cookie)) {
    problems.push(
      `visitor ${index}: ${matched} matches, expected ${admirerCount(cookie)}`,
    );
  }
  if (matches.matches.length !== matched) {
    problems.push(
      `visitor ${index}: /matches lists ${matches.matches.length}, swipes said ${matched}`,
    );
  }
}

function percentile(sorted: number[], p: number) {
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ];
}

async function main() {
  console.log(
    `Load test: ${VISITORS} visitors, ${CONCURRENCY} at a time, ${BASE_URL}`,
  );
  const started = performance.now();
  let next = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < VISITORS) {
      const index = next++;
      await visitor(index).catch(() => {});
    }
  });
  await Promise.all(workers);
  const seconds = (performance.now() - started) / 1000;

  console.log(
    `\n${requests} requests in ${seconds.toFixed(1)}s (${(requests / seconds).toFixed(0)} req/s)\n`,
  );
  console.log(
    "route".padEnd(16) +
      "count".padStart(7) +
      "p50".padStart(9) +
      "p95".padStart(9) +
      "p99".padStart(9) +
      "max".padStart(9) +
      "  (ms)",
  );
  for (const [route, list] of [...latencies].sort()) {
    const sorted = [...list].sort((a, b) => a - b);
    console.log(
      route.padEnd(16) +
        String(sorted.length).padStart(7) +
        percentile(sorted, 50).toFixed(0).padStart(9) +
        percentile(sorted, 95).toFixed(0).padStart(9) +
        percentile(sorted, 99).toFixed(0).padStart(9) +
        sorted[sorted.length - 1].toFixed(0).padStart(9),
    );
  }

  if (problems.length) {
    console.error(`\nFAILED: ${problems.length} problem(s)`);
    for (const problem of problems.slice(0, 20))
      console.error("  - " + problem);
    process.exit(1);
  }
  console.log(
    `\nOK: all ${VISITORS} visitors got correct, error-free results.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
