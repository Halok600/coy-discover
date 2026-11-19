import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { card, dismissMatch, openDiscover, topName } from "./helpers";

/** For tests that inject failures on purpose (a 5xx is then expected). */
const allowErrors = () =>
  test.info().annotations.push({ type: "allow-errors" });

const like = (page: Page) => page.getByRole("button", { name: "Like" });
const pass = (page: Page) => page.getByRole("button", { name: "Pass" });
const modal = (page: Page) => page.getByTestId("match-modal");
const toast = (page: Page) => page.getByText(/Couldn.t save that swipe/);

type Profile = {
  id: string;
  name: string;
  age: number;
  photoUrl: string;
  bio: string;
  location: string;
  interests: string[];
};

/** Remembers every profile the deck has been served, keyed by id. */
function trackProfiles(page: Page) {
  const seen = new Map<string, Profile>();
  page.on("response", async (response) => {
    if (/\/feed\?/.test(response.url()) && response.ok()) {
      try {
        for (const p of (await response.json()).profiles) seen.set(p.id, p);
      } catch {
        /* ignore */
      }
    }
  });
  return seen;
}

/** Records every POST /swipe the page makes and what the server answered. */
function trackSwipes(page: Page) {
  const sent: { profileId: string; action: string }[] = [];
  const statuses: number[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/swipe") && r.method() === "POST") {
      sent.push(r.postDataJSON());
    }
  });
  page.on("response", (r) => {
    if (r.url().endsWith("/swipe") && r.request().method() === "POST") {
      statuses.push(r.status());
    }
  });
  return { sent, statuses };
}

test.describe("hammering the controls", () => {
  test("double-clicking Like swipes once, not twice", async ({ page }) => {
    await openDiscover(page);
    const { sent } = trackSwipes(page);
    await like(page).dblclick();
    await page.waitForTimeout(1200);
    expect(sent).toHaveLength(1);
  });

  test("25 rapid clicks never swipe a profile twice or trigger an error", async ({
    page,
  }) => {
    await openDiscover(page);
    const { sent, statuses } = trackSwipes(page);

    for (let i = 0; i < 25; i++) {
      if (await modal(page).isVisible()) await page.keyboard.press("Escape");
      await like(page)
        .click({ force: true, noWaitAfter: true, timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(35);
    }
    await page.waitForTimeout(1500);

    const ids = sent.map((s) => s.profileId);
    expect(new Set(ids).size, "no profile swiped twice").toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(
      statuses.every((s) => s === 200),
      `statuses ${statuses}`,
    ).toBe(true);
    await expect(toast(page)).toBeHidden();
  });

  test("30 rapid arrow-key presses behave the same", async ({ page }) => {
    await openDiscover(page);
    const { sent, statuses } = trackSwipes(page);

    for (let i = 0; i < 30; i++) {
      if (await modal(page).isVisible()) await page.keyboard.press("Escape");
      await page.keyboard.press(i % 3 === 0 ? "ArrowLeft" : "ArrowRight");
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(1500);

    const ids = sent.map((s) => s.profileId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      statuses.every((s) => s === 200),
      `statuses ${statuses}`,
    ).toBe(true);
    await expect(toast(page)).toBeHidden();
  });
});

test.describe("when the network or server misbehaves", () => {
  test("offline: the card comes back with a message, and works again once online", async ({
    page,
    context,
  }) => {
    await openDiscover(page);
    const before = await topName(page);

    await context.setOffline(true);
    await like(page).click();
    await expect(toast(page)).toBeVisible();
    await expect.poll(() => topName(page)).toBe(before);

    await context.setOffline(false);
    await like(page).click();
    await expect.poll(() => topName(page)).not.toBe(before);
  });

  test("a 500 from /swipe returns the card and shows a message", async ({
    page,
  }) => {
    allowErrors();
    await openDiscover(page);
    const before = await topName(page);
    await page.route("**/swipe", (route) =>
      route.fulfill({
        status: 500,
        json: {
          error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
        },
      }),
    );

    await pass(page).click();
    await expect(toast(page)).toBeVisible();
    await expect.poll(() => topName(page)).toBe(before);

    await page.unroute("**/swipe");
    await pass(page).click();
    await expect.poll(() => topName(page)).not.toBe(before);
  });

  test("an aborted request returns the card", async ({ page }) => {
    await openDiscover(page);
    const before = await topName(page);
    await page.route("**/swipe", (route) => route.abort("failed"));

    await like(page).click();
    await expect(toast(page)).toBeVisible();
    await expect.poll(() => topName(page)).toBe(before);
  });

  test("a 409 (already swiped elsewhere) just moves on, with no scary message", async ({
    page,
  }) => {
    await openDiscover(page);
    const before = await topName(page);
    await page.route("**/swipe", (route) =>
      route.fulfill({
        status: 409,
        json: {
          error: { code: "ALREADY_SWIPED", message: "Swipes are final." },
        },
      }),
    );

    await like(page).click();
    await expect.poll(() => topName(page)).not.toBe(before);
    await page.waitForTimeout(700);
    await expect(toast(page)).toBeHidden();
  });

  test("slow responses: several quick swipes all land, and none come back after a reload", async ({
    page,
  }) => {
    await openDiscover(page);
    const swiped: string[] = [];
    let answered = 0;
    await page.route("**/swipe", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
      answered++;
    });

    for (let i = 0; i < 4; i++) {
      swiped.push((await topName(page))!);
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => topName(page)).not.toBe(swiped[i]);
    }
    await expect.poll(() => answered, { timeout: 15_000 }).toBe(4);
    await page.unroute("**/swipe");

    await page.reload();
    await expect(card(page)).toBeVisible();
    const feed = await (await page.request.get("/feed?limit=30")).json();
    const names = feed.profiles.map((p: Profile) => p.name);
    for (const name of swiped) expect(names).not.toContain(name);
  });

  test("the deck failing to load shows an error with a working retry", async ({
    page,
  }) => {
    allowErrors();
    await page.route(/\/feed(\?|$)/, (route) => route.abort("failed"));
    await page.goto("/discover");
    await expect(
      page.getByText("Couldn't load profiles").first(),
    ).toBeVisible();

    await page.unroute(/\/feed(\?|$)/);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(card(page)).toBeVisible();
  });

  test("the deck failing to refill never leaves you stuck", async ({
    page,
  }) => {
    allowErrors();
    await openDiscover(page);
    // Only the first page loads; every refill fails.
    await page.route(/\/feed(\?|$)/, (route) => route.abort("failed"));

    // Swipe through the whole first page (10 cards).
    for (let i = 0; i < 10; i++) {
      const name = await topName(page);
      if (name === null) break;
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => topName(page)).not.toBe(name);
    }

    // There must be a way out, not an endless skeleton.
    const retry = page.getByRole("button", { name: "Try again" });
    await expect(retry).toBeVisible({ timeout: 8000 });

    await page.unroute(/\/feed(\?|$)/);
    await retry.click();
    await expect(card(page)).toBeVisible();
  });

  test("clearing cookies mid-session doesn't break the app", async ({
    page,
    context,
  }) => {
    await openDiscover(page);
    await context.clearCookies();
    const before = await topName(page);

    await pass(page).click();
    await expect.poll(() => topName(page)).not.toBe(before);
    await expect(toast(page)).toBeHidden();

    await page.reload();
    await expect(card(page)).toBeVisible();
  });
});

test.describe("state across tabs and navigation", () => {
  test("two tabs of the same visitor: swiping the same profile in both is harmless", async ({
    context,
  }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto("/discover");
    await b.goto("/discover");
    await expect(card(a)).toBeVisible();
    await expect(card(b)).toBeVisible();
    const first = await topName(a);
    expect(await topName(b)).toBe(first);

    const answered = a.waitForResponse((r) => r.url().endsWith("/swipe"));
    await a.keyboard.press("ArrowLeft");
    await answered;
    await expect.poll(() => topName(a)).not.toBe(first);

    // Tab B is stale: the server already has this swipe and answers 409.
    await b.bringToFront();
    await b.keyboard.press("ArrowLeft");
    await expect.poll(() => topName(b)).not.toBe(first);
    await b.waitForTimeout(700);
    await expect(toast(b)).toBeHidden();
  });

  test("back and forward never bring a swiped profile back", async ({
    page,
  }) => {
    await openDiscover(page);
    const swiped: string[] = [];
    for (let i = 0; i < 3; i++) {
      swiped.push((await topName(page))!);
      await pass(page).click();
      await expect.poll(() => topName(page)).not.toBe(swiped[i]);
    }
    await page.waitForTimeout(500);

    await page.getByRole("link", { name: /^Matches/ }).click();
    await expect(page).toHaveURL(/matches$/);
    await page.goBack();
    await expect(card(page)).toBeVisible();
    expect(swiped).not.toContain(await topName(page));
    await page.goForward();
    await page.goBack();
    await expect(card(page)).toBeVisible();
    expect(swiped).not.toContain(await topName(page));
  });

  test("reloading right after a swipe leaves a healthy app", async ({
    page,
  }) => {
    await openDiscover(page);
    await like(page).click();
    await page.reload();
    await expect(card(page)).toBeVisible();
    await like(page).click();
    await page.waitForTimeout(800);
    await expect(card(page).or(page.getByTestId("caught-up"))).toBeVisible();
  });
});

test.describe("match dialog", () => {
  test("two matches arriving together are shown one after the other", async ({
    page,
  }) => {
    await openDiscover(page);
    const profiles = trackProfiles(page);
    await page.reload();
    await expect(card(page)).toBeVisible();

    let n = 0;
    await page.route("**/swipe", async (route) => {
      const { profileId } = route.request().postDataJSON();
      const delay = n++ === 0 ? 1800 : 1100; // both land at about the same time
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        json: {
          matched: true,
          match: {
            id: `m-${profileId}`,
            matchedAt: new Date().toISOString(),
            profile: profiles.get(profileId),
          },
        },
      });
    });

    const names = [(await topName(page))!];
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => topName(page)).not.toBe(names[0]);
    names.push((await topName(page))!);
    await page.keyboard.press("ArrowRight");

    await expect(modal(page)).toBeVisible({ timeout: 6000 });
    const readName = async () => {
      const text = await modal(page).innerText();
      return names.find((name) => text.includes(name)) ?? "?";
    };
    const firstShown = await readName();
    await page.getByRole("button", { name: "Keep swiping" }).click();
    // Dismissing the first reveals the second, not an empty screen.
    await expect.poll(readName).not.toBe(firstShown);
    const secondShown = await readName();
    await dismissMatch(page);
    expect([firstShown, secondShown].sort()).toEqual([...names].sort());
    await expect(modal(page)).toBeHidden();
  });

  test("Tab stays inside the dialog, and Escape closes it", async ({
    page,
  }) => {
    await openDiscover(page);
    const profiles = trackProfiles(page);
    await page.reload();
    await expect(card(page)).toBeVisible();
    await page.route("**/swipe", async (route) => {
      const { profileId } = route.request().postDataJSON();
      await route.fulfill({
        json: {
          matched: true,
          match: {
            id: "m1",
            matchedAt: new Date().toISOString(),
            profile: profiles.get(profileId),
          },
        },
      });
    });
    await like(page).click();
    await expect(modal(page)).toBeVisible();

    const dialog = page.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((d) =>
        d.contains(document.activeElement),
      );
      expect(inside, `Tab #${i + 1} left the dialog`).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(modal(page)).toBeHidden();
    // The deck is usable again.
    await expect(like(page)).toBeEnabled();
  });

  test("with reduced motion there is no confetti, and swiping still works", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDiscover(page);
    const profiles = trackProfiles(page);
    await page.reload();
    await expect(card(page)).toBeVisible();
    await page.route("**/swipe", (route) => {
      const { profileId } = route.request().postDataJSON();
      return route.fulfill({
        json: {
          matched: true,
          match: {
            id: "m1",
            matchedAt: new Date().toISOString(),
            profile: profiles.get(profileId),
          },
        },
      });
    });
    const before = await topName(page);
    await like(page).click();
    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator("span.size-3")).toHaveCount(0);
    await dismissMatch(page);
    expect(await topName(page)).not.toBe(before);
  });
});

test.describe("hostile and extreme profile content", () => {
  test("very long, emoji, RTL and script-like text can't break the card or run code", async ({
    page,
  }) => {
    await page.route(/\/feed(\?|$)/, (route) =>
      route.fulfill({
        json: {
          hasMore: false,
          profiles: [
            {
              id: "00000000-0000-4000-8000-0000000000aa",
              name: "A".repeat(200) + " 😀👩‍👩‍👧‍👦",
              age: 99,
              photoUrl: "https://i.pravatar.cc/640?img=5",
              bio:
                "<img src=x onerror=window.__xss=1><script>window.__xss=1</script> " +
                "b".repeat(1500) +
                " مرحبا بالعالم ".repeat(40),
              location: "مدينة طويلة جدا ".repeat(20) + "L".repeat(120),
              interests: [
                "<script>window.__xss=1</script>",
                "x".repeat(90),
                "🙂",
                "a",
                "b",
                "c",
              ],
            },
          ],
        },
      }),
    );
    await page.goto("/discover");
    const article = card(page).getByRole("article");
    await expect(article).toBeVisible();

    const fits = async () => {
      const box = await article.boundingBox();
      const parts = await article
        .locator("h2, p, ul, button")
        .evaluateAll((els) =>
          els
            .map((el) => el.getBoundingClientRect())
            .map((r) => ({ l: r.left, r: r.right, b: r.bottom })),
        );
      for (const part of parts) {
        expect(part.l).toBeGreaterThanOrEqual(box!.x - 1);
        expect(part.r).toBeLessThanOrEqual(box!.x + box!.width + 1);
        expect(part.b).toBeLessThanOrEqual(box!.y + box!.height + 1);
      }
      expect(
        await article.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    };

    await fits(); // compact
    await card(page)
      .getByRole("button", { name: /^More about/ })
      .click();
    await expect(
      card(page).getByRole("list", { name: "Interests" }),
    ).toBeVisible();
    await page.waitForTimeout(500);
    await fits(); // expanded

    // Rendered as text, never executed.
    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined();
    await expect(card(page)).toContainText("<script>window.__xss=1</script>");
  });
});

test.describe("images", () => {
  test("if photos fail to load, cards fall back to initials and stay usable", async ({
    page,
  }) => {
    await page.route("**/_next/image**", (route) => route.abort("failed"));
    await page.route("https://i.pravatar.cc/**", (route) =>
      route.abort("failed"),
    );
    await page.goto("/discover");
    await expect(card(page)).toBeVisible();

    const name = (await topName(page))!;
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("");
    await expect(card(page).getByText(initials, { exact: true })).toBeVisible();

    await card(page).click({ position: { x: 50, y: 100 } });
    await expect(card(page).locator("h2")).toBeHidden();
    await card(page).click({ position: { x: 50, y: 100 } });
    await like(page).click();
    await expect.poll(() => topName(page)).not.toBe(name);
  });
});

test.describe("keyboard only", () => {
  test("a sensible tab order, visible focus, and Enter swipes", async ({
    page,
  }) => {
    await openDiscover(page);
    const label = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (
          el?.getAttribute("aria-label") ||
          el?.textContent?.trim() ||
          el?.tagName
        );
      });

    const order: (string | undefined)[] = [];
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("Tab");
      order.push(await label());
    }
    expect(order[0]).toMatch(/^Matches/);
    expect(order[1]).toBe("Hide details to see the photo");
    expect(order[2]).toMatch(/^More about/);
    expect(order.slice(3)).toEqual(["Pass", "Like", "Home", "Discover"]);

    // Focus is visible on the controls.
    await page.keyboard.press("Shift+Tab"); // Home
    await page.keyboard.press("Shift+Tab"); // Like
    expect(await label()).toBe("Like");
    const outline = await page.evaluate(
      () => getComputedStyle(document.activeElement!).outlineStyle,
    );
    expect(outline).not.toBe("none");

    const before = await topName(page);
    await page.keyboard.press("Enter");
    await expect.poll(() => topName(page)).not.toBe(before);
  });
});

test.describe("touch input (real touch events)", () => {
  test.skip(({ hasTouch }) => !hasTouch, "touch devices only");

  async function touchDrag(page: Page, dx: number, dy: number) {
    const box = (await card(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 3;
    const cdp = await page.context().newCDPSession(page);
    const point = (px: number, py: number) => [{ x: px, y: py, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: point(x, y),
    });
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: point(x + (dx * i) / steps, y + (dy * i) / steps),
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }

  test("dragging with a finger right likes and left passes", async ({
    page,
  }) => {
    await openDiscover(page);
    for (const [dx, action] of [
      [240, "like"],
      [-240, "pass"],
    ] as const) {
      const before = await topName(page);
      const sent = page.waitForRequest(
        (r) => r.url().endsWith("/swipe") && r.postDataJSON().action === action,
      );
      await touchDrag(page, dx, 0);
      await sent;
      await expect.poll(() => topName(page)).not.toBe(before);
      if (await modal(page).isVisible()) await dismissMatch(page);
    }
  });

  test("a short finger drag snaps back, and a vertical drag does not swipe", async ({
    page,
  }) => {
    await openDiscover(page);
    const { sent } = trackSwipes(page);
    const before = await topName(page);

    await touchDrag(page, 45, 0);
    await page.waitForTimeout(600);
    expect(await topName(page)).toBe(before);

    await touchDrag(page, 0, -220);
    await page.waitForTimeout(600);
    expect(await topName(page)).toBe(before);
    expect(sent).toHaveLength(0);
    await expect(card(page).locator("h2")).toBeVisible(); // not toggled either
  });

  test("tapping the photo with a finger hides and shows the info", async ({
    page,
  }) => {
    await openDiscover(page);
    const box = (await card(page).boundingBox())!;
    const spot = { x: box.x + 60, y: box.y + 110 };

    await page.touchscreen.tap(spot.x, spot.y);
    await expect(card(page).locator("h2")).toBeHidden();
    await page.touchscreen.tap(spot.x, spot.y);
    await expect(card(page).locator("h2")).toBeVisible();
  });

  test("tapping More and the eye with a finger doesn't also toggle the card", async ({
    page,
  }) => {
    await openDiscover(page);
    const more = card(page).getByRole("button", { name: /^More about/ });
    const box = (await more.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(
      card(page).getByRole("list", { name: "Interests" }),
    ).toBeVisible();
    await expect(card(page).locator("h2")).toBeVisible();
  });
});

test.describe("a monkey clicking at random", () => {
  test("a seeded random mix of swipes, taps and toggles ends in a consistent state", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    let seed = 20261119;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    await openDiscover(page);
    const { sent, statuses } = trackSwipes(page);
    let matches = 0;

    const started = Date.now();
    for (let guard = 0; guard < 200; guard++) {
      // Progress trail, so a slow or stalled run shows exactly where it was.
      if (guard % 10 === 0) {
        console.log(
          `[monkey ${test.info().project.name}] step ${guard}, ${sent.length} swipes sent, ${Math.round((Date.now() - started) / 1000)}s`,
        );
      }
      const name = await topName(page);
      if (name === null && !(await card(page).count())) {
        if (await page.getByTestId("caught-up").isVisible()) break;
        await page.waitForTimeout(150);
        continue;
      }
      // Fiddle with the card first.
      const toggle = rand();
      if (toggle < 0.2) await card(page).click({ position: { x: 50, y: 100 } });
      else if (toggle < 0.35) {
        await card(page)
          .getByRole("button", { name: /(More|Less) about/ })
          .click({ timeout: 1500 })
          .catch(() => {});
      }

      const action = rand() < 0.5 ? "like" : "pass";
      const method = rand();
      const before = await topName(page);
      if (method < 0.4)
        await page.keyboard.press(
          action === "like" ? "ArrowRight" : "ArrowLeft",
        );
      else if (method < 0.8)
        await (action === "like" ? like(page) : pass(page)).click({
          timeout: 3000,
        });
      else {
        const box = (await card(page).boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width / 2 + (action === "like" ? 230 : -230),
          box.y + box.height / 2,
          { steps: 8 },
        );
        await page.mouse.up();
      }

      await expect
        .poll(
          async () =>
            (await modal(page).isVisible()) ||
            (await topName(page)) !== before ||
            (await page.getByTestId("caught-up").isVisible()),
          { timeout: 8000 },
        )
        .toBe(true);
      // Wait for this swipe's answer; dismiss a match if there is one.
      await expect
        .poll(() => statuses.length, { timeout: 8000 })
        .toBeGreaterThan(0);
      if (
        await modal(page)
          .isVisible({ timeout: 250 })
          .catch(() => false)
      ) {
        matches++;
        await dismissMatch(page);
      }
    }

    await expect(page.getByTestId("caught-up")).toBeVisible({
      timeout: 15_000,
    });
    // Late match dialogs may still be arriving; clear them.
    while (
      await modal(page)
        .isVisible({ timeout: 300 })
        .catch(() => false)
    ) {
      matches++;
      await dismissMatch(page);
    }

    const ids = sent.map((s) => s.profileId);
    expect(new Set(ids).size, "no profile swiped twice").toBe(ids.length);
    expect(ids).toHaveLength(32);
    expect(
      statuses.every((s) => s === 200),
      `statuses ${[...new Set(statuses)]}`,
    ).toBe(true);

    // The server agrees with the screen.
    const serverMatches = (await (await page.request.get("/matches")).json())
      .matches.length;
    expect(serverMatches).toBe(matches);
    const likedAdmirers = sent.filter((s) => s.action === "like").length;
    expect(serverMatches).toBeLessThanOrEqual(likedAdmirers);
    expect(
      (await (await page.request.get("/feed?limit=30")).json()).profiles,
    ).toHaveLength(0);
  });
});
