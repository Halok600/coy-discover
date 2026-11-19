# Coy Discover

A swipe-based **Discover** tab for [Coy](https://getcoy.com), the double-blind crush-matching app, built as a standalone app with a placeholder **Home** tab beside it.

[![CI](https://github.com/Halok600/coy-discover/actions/workflows/ci.yml/badge.svg)](https://github.com/Halok600/coy-discover/actions/workflows/ci.yml)

Swipe right to like, left to pass. A match happens **only when both people liked each other**, and nothing in the app, the API, or the order of the deck ever reveals who liked you first. That is Coy's core promise, and it is the part of this project that is tested hardest.

<p>
  <img src="docs/screenshots/discover.png" alt="Photo first, with a slim info strip" width="180" />
  <img src="docs/screenshots/details.png" alt="More expands the bio and interests" width="180" />
  <img src="docs/screenshots/photo-only.png" alt="Tap the photo to hide the info" width="180" />
  <img src="docs/screenshots/match.png" alt="The It's a match dialog" width="180" />
  <img src="docs/screenshots/matches.png" alt="The Matches list" width="180" />
</p>

## Features

- **Photo-first cards**: each card shows the face with only a slim name, age and city strip. **Tap the photo** and all the info disappears so you see the whole picture (tap again to bring it back); **More** expands the bio and interests. An eye button does the same toggle for keyboard and screen-reader users.
- **Swipe deck**: one card at a time, drag gestures on touch and mouse, **Like / Pass buttons** and **← / → keys** on desktop. The card follows your finger, tilts, and shows LIKE / NOPE stamps; release past the threshold (or flick) and it flies off, otherwise it springs back.
- **Never repeats**: a swiped profile never appears again, even across reloads or while its swipe is still in flight.
- **It's a match!** dialog on a mutual like (focus-trapped, `Esc` to close, confetti unless you prefer reduced motion) and a **Matches** view listing everyone you matched with.
- **Clear states**: loading skeletons, an offline/error state with retry, a "You're all caught up" empty state with **Start over**.
- **Persistent**: swipes and matches live in Postgres, so they survive reloads.
- **Coy's own look**: Bricolage Grotesque, ink outlines with hard offset shadows, pastel cards, pill buttons and the tilted pink match card, taken from the design tokens on getcoy.com.
- **Mobile-first**, with a framed device-style column on desktop, `prefers-reduced-motion` support and screen-reader announcements for each swipe.

## Privacy design

The brief says: _never reveal who has liked the user unless it is mutual_. Each way a build could leak that, and what stops it here:

| Leak                                              | What prevents it                                                                                                                                    | Enforced by                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A `likedYou` flag or raw DB rows in `GET /feed`   | Every response is built field by field in one serializer (`toPublicProfile`); a new column can't leak by accident                                   | `privacy.test.ts` asserts the exact key set          |
| Deck order that puts admirers first               | The deck is ordered by `md5(viewer_id \|\| profile_id)`: stable per visitor, unrelated to likes                                                     | `privacy.test.ts` recomputes the order independently |
| `POST /swipe` answering differently for admirers  | The reciprocal lookup runs for **every** swipe; a pass on an admirer returns byte-for-byte the same `{ "matched": false }` as a pass on anyone else | `privacy.test.ts`, `routes.test.ts`                  |
| Probing by re-swiping                             | Swipes are final: the `(swiper, target)` primary key makes a second swipe a `409`, so an outcome can't be re-rolled                                 | `swipe.test.ts`, e2e                                 |
| A "who liked me" endpoint, count, or badge        | None exists. The only relationship the API ever exposes is a mutual match, and the header badge counts matches only                                 | Code review + e2e                                    |
| Filtering in the browser                          | All filtering happens in SQL on the server                                                                                                          | Architecture                                         |
| Forged identity cookie acting as a seeded profile | The viewer cookie is validated as a UUID and refused if it names a seeded member                                                                    | `routes.test.ts`                                     |
| One visitor seeing another's data                 | Every query is scoped to the visitor's id                                                                                                           | `privacy.test.ts`, e2e                               |

## How it works

```mermaid
flowchart LR
  subgraph Browser
    UI[Discover UI<br/>swipe deck, match dialog]
    Q[TanStack Query<br/>matches cache]
  end
  subgraph Next.js on Vercel
    P[proxy.ts<br/>issues anonymous visitor cookie]
    R[Route handlers<br/>/feed /swipe /matches]
    S[Services<br/>feed, swipe, matches, viewer]
    D[(Drizzle ORM)]
  end
  DB[(Postgres<br/>Neon in prod, PGlite locally)]
  UI -->|fetch| R
  UI --- Q
  P -.cookie.-> UI
  R --> S --> D --> DB
```

- **Identity.** The brief says to assume one logged-in user. On a public demo that would let the first visitor use up the deck for everyone, so each visitor gets an anonymous, HttpOnly cookie (set in `proxy.ts` on page load) that stands in for "the logged-in user". There is no login and no external auth.
- **Seeded admirers.** The first time a visitor is seen, 8 to 10 seeded members are recorded as having already liked them (chosen per visitor), so matches happen in a demo. They are stored as ordinary swipe rows and are only revealed through the normal mutual-match path.
- **Layers.** Route handlers parse the request and map errors; `src/server/services/*` hold the business rules and take the database as a parameter (so tests run on in-memory Postgres); Drizzle talks to Postgres.
- **One database, two drivers.** With `DATABASE_URL` set, the app uses `pg` (Neon in production). Without it, it runs an embedded Postgres (PGlite) in `.data/` and seeds itself, so `npm run dev` needs no setup.
- **Optimistic UI.** The card leaves instantly and `POST /swipe` runs in the background; if it fails the card returns with a message. The deck refills from `/feed` when three cards remain.

### Data model

```
users    id, kind ('member' | 'viewer'), name, age, photo_url, bio, location, interests[], created_at
swipes   (swiper_id, target_id) PRIMARY KEY, action ('like' | 'pass'), created_at
matches  id, user_a, user_b  UNIQUE, CHECK (user_a < user_b), created_at
```

`swipes` has no `UPDATE` path, so swipes are final. `matches` stores each pair once in canonical order. Deleting a visitor cascades to their swipes and matches.

## API

The brief's paths work as written (`/feed`, `/swipe`, `/matches`); they are rewritten to route handlers under `/api`. All responses are `Cache-Control: no-store`. Errors share one envelope: `{ "error": { "code", "message" } }`.

### `GET /feed?limit=10`

Profiles the visitor has not swiped on yet (`limit` 1 to 30).

```json
{
  "profiles": [
    {
      "id": "00000000-0000-4000-8000-00000000001a",
      "name": "Neel Saxena",
      "age": 27,
      "photoUrl": "https://i.pravatar.cc/640?img=68",
      "bio": "Runs a small family cafe and a smaller podcast.",
      "location": "Indore",
      "interests": ["Podcasts", "Poha", "Entrepreneurship", "Badminton"]
    }
  ],
  "hasMore": true
}
```

### `POST /swipe`

```http
POST /swipe
Content-Type: application/json

{ "profileId": "00000000-0000-4000-8000-00000000001a", "action": "like" }
```

Not a match (a pass, or a like nobody returned), always this exact body:

```json
{ "matched": false }
```

A mutual like:

```json
{
  "matched": true,
  "match": {
    "id": "5b0c…",
    "matchedAt": "2026-11-18T10:21:04.512Z",
    "profile": { "id": "…", "name": "Mahi Rathore", "age": 21, "…": "…" }
  }
}
```

Errors: `400 VALIDATION_ERROR` (bad body), `404 PROFILE_NOT_FOUND`, `409 ALREADY_SWIPED`.

### `GET /matches`

```json
{ "matches": [{ "id": "5b0c…", "matchedAt": "…", "profile": { "…": "…" } }] }
```

### Other routes

| Route                   | Purpose                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST /api/demo/reset`  | "Start over": clears the visitor's swipes and matches and restores a fresh deck                      |
| `GET /api/health`       | Liveness probe that also checks the database                                                         |
| `GET /api/cron/cleanup` | Daily Vercel Cron job that removes idle demo visitors; requires `Authorization: Bearer $CRON_SECRET` |

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:3000, zero config
```

The first request creates an embedded database in `.data/` and seeds 32 profiles. Delete `.data/` to start fresh.

To use a real Postgres instead, copy `.env.example` to `.env.local`, set `DATABASE_URL`, then run `npm run db:migrate && npm run db:seed`.

## Tests

```bash
npm test                  # 88 unit and API tests on in-memory Postgres
npm run test:e2e          # ~220 Playwright tests, mobile (Pixel 7) and desktop Chrome
npm run lint && npm run typecheck && npm run format:check
```

First time only: `npx playwright install chromium`.

- **Unit** (`tests/unit`): matching rules, swipe finality, feed behaviour, viewer lifecycle, idle cleanup, seed data, and the privacy guarantees above. Plus **concurrency** tests (simultaneous swipes, a reset landing mid-swipe, many visitors at once) and **randomized property tests**: hundreds of random swipe sequences, each checked against invariants such as "a match always has a like on both sides".
- **API** (`tests/api`): the real route handlers called with real `Request` objects: cookies, validation, status codes, error bodies, cron authorization.
- **End-to-end** (`e2e`), against a production build and a throwaway database:
  - `discover`: drag and button swipes, arrow keys, the three card states, a full run through the deck, persistence and restart.
  - `resilience`: rapid-fire clicks, offline mode, injected `500`/`409`/aborted requests, slow responses, a deck that fails to refill, cleared cookies, two tabs, back/forward, two matches arriving together, extreme profile text, blocked images, reduced motion, keyboard-only use, real touch events, and a seeded random "monkey".
  - `api-hostile`: malformed bodies, SQL-injection strings, huge payloads, hostile query strings and cookies, image-proxy SSRF attempts, security headers, and a privacy crawl across many visitors over real HTTP.
  - `layout`: ten screen sizes from 320×480 to 1440×900, including a landscape phone.
  - `a11y`: an axe-core WCAG 2.1 AA audit of every screen state.

Every e2e test also fails on any uncaught page error, console error, or server 5xx.

### Run the backend suite on real Postgres

By default the unit and API tests use an embedded database. Point them at a real server and each test file gets its own throwaway database, so the same suites exercise the production driver with truly concurrent connections:

```bash
TEST_DATABASE_URL=postgres://postgres:password@localhost:5432/postgres npm test
```

CI does this on every push (the `postgres` job), then also runs `db:migrate` and `db:seed` twice and a load test.

### Load test

```bash
npm run build && npm start
BASE_URL=http://localhost:3000 VISITORS=100 CONCURRENCY=25 npm run loadtest
```

Each virtual visitor likes the whole deck. Beyond latency, it checks that every visitor ends with exactly as many matches as admirers.

## Deploy (Vercel + Neon)

1. Push this repo to GitHub and **import it in Vercel** (the Next.js preset is detected automatically).
2. In the Vercel project, open **Storage → Create → Neon (Postgres)** and connect it. This injects `DATABASE_URL`. Pick a region close to your functions.
3. Add an environment variable **`CRON_SECRET`** (any random string of 16+ characters). Vercel Cron sends it automatically.
4. Deploy. The `vercel-build` script runs `db:migrate` and `db:seed` before `next build`, so the database is ready on first load. `vercel.json` schedules the daily cleanup job.

Preview deployments share the same database unless you enable Neon's branch-per-preview option.

## Project structure

```
src/
  app/                 pages (/, /discover, /discover/matches) and route handlers (/api/*)
  components/          swipe card, profile card, controls, match dialog, state screens
  lib/                 API client, deck state hook, shared wire types, formatters
  server/
    db/                Drizzle schema and the Postgres / PGlite client
    services/          feed, swipe, matches, viewer: all business rules
    seed/              32 mock profiles and the idempotent seeder
    dto.ts             the single public-profile serializer
    http.ts            route wrapper: visitor cookie, error envelope, no-store
  proxy.ts             issues the anonymous visitor cookie on page loads
drizzle/               SQL migrations
tests/                 unit and API tests (Vitest)
e2e/                   end-to-end tests (Playwright)
scripts/               db:migrate, db:seed, README screenshots
```

## Trade-offs and what I'd do next

- **Anonymous cookie instead of auth**, as the brief allows. In Coy proper this is the signed-in user id; nothing else would change.
- **Synthetic admirers.** Real likes would come from real users; seeding them as swipe rows keeps the matching code identical.
- **No rate limiting.** A production build would limit `/swipe` per user to slow down scripted probing (Vercel WAF or a token bucket in Redis).
- **Photos are hotlinked placeholders** from [pravatar.cc](https://pravatar.cc), served through the Next.js image optimizer. Names, bios and people in the seed data are fictional; a failed image falls back to initials.
- **CSP allows inline scripts**, because Next.js injects inline bootstrap code. Nonce-based CSP would tighten it.
- **Swipes are final by design** (it's what stops probing), so there is no undo.

## License

[MIT](LICENSE)
