import { expect, test } from "./fixtures";
import {
  card,
  dismissMatch,
  dragCard,
  openDiscover,
  swipeWithButton,
  topName,
} from "./helpers";

// Each test gets a fresh browser context, hence its own anonymous visitor,
// its own deck and its own matches.

test.describe("tabs", () => {
  test("Home is blank and Discover holds the feature", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("navigation", { name: "Main" });
    await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(card(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Like" })).toHaveCount(0);

    await tabs.getByRole("link", { name: "Discover" }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect(card(page)).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("swiping", () => {
  test("shows one profile at a time, photo first with a slim info strip", async ({
    page,
  }) => {
    await openDiscover(page);
    await expect(card(page)).toHaveCount(1);
    const article = card(page).getByRole("article");
    await expect(article.locator("h2")).toBeVisible();
    // The bio and interests stay out of the way until asked for.
    await expect(article.getByRole("list", { name: "Interests" })).toHaveCount(
      0,
    );
  });

  test("More expands the bio and interests, Less collapses them", async ({
    page,
  }) => {
    await openDiscover(page);
    const interests = card(page).getByRole("list", { name: "Interests" });

    await card(page)
      .getByRole("button", { name: /^More about/ })
      .click();
    await expect(interests).toBeVisible();

    await card(page)
      .getByRole("button", { name: /^Less about/ })
      .click();
    await expect(interests).toHaveCount(0);
  });

  test("tapping the photo hides all the info, and tapping again restores it", async ({
    page,
  }) => {
    await openDiscover(page);
    let swipeRequests = 0;
    page.on("request", (r) => r.url().endsWith("/swipe") && swipeRequests++);
    const heading = card(page).locator("h2");
    const hint = card(page).getByText("Tap the photo to show info");
    // Top-left of the card: bare photo, clear of every button.
    const photo = { position: { x: 50, y: 100 } };

    await card(page).click(photo);
    await expect(heading).toBeHidden();
    await expect(hint).toBeVisible();

    await card(page).click(photo);
    await expect(heading).toBeVisible();
    await expect(hint).toBeHidden();

    // Tapping is not swiping.
    expect(swipeRequests).toBe(0);
  });

  test("the eye button gives the same toggle without a tap", async ({
    page,
  }) => {
    await openDiscover(page);
    const heading = card(page).locator("h2");

    await card(page)
      .getByRole("button", { name: "Hide details to see the photo" })
      .click();
    await expect(heading).toBeHidden();

    const show = card(page).getByRole("button", { name: "Show details" });
    await expect(show).toHaveAttribute("aria-pressed", "true");
    await show.click();
    await expect(heading).toBeVisible();
  });

  test("each new card starts with the info showing", async ({ page }) => {
    await openDiscover(page);
    await card(page)
      .getByRole("button", { name: "Hide details to see the photo" })
      .click();
    await expect(card(page).locator("h2")).toBeHidden();

    await page.getByRole("button", { name: "Pass" }).click();
    await expect(card(page).locator("h2")).toBeVisible();
  });

  test("the Like and Pass buttons advance the deck", async ({ page }) => {
    await openDiscover(page);
    const first = await topName(page);

    await swipeWithButton(page, "pass");
    await expect.poll(() => topName(page)).not.toBe(first);
    const second = await topName(page);

    await swipeWithButton(page, "like");
    await expect.poll(() => topName(page)).not.toBe(second);
  });

  test("dragging right likes and dragging left passes", async ({ page }) => {
    await openDiscover(page);

    for (const [dx, label] of [
      [220, "like"],
      [-220, "pass"],
    ] as const) {
      const before = await topName(page);
      const swipeDone = page.waitForResponse(
        (response) =>
          response.url().endsWith("/swipe") &&
          response.request().method() === "POST" &&
          response.request().postDataJSON().action === label,
      );
      const drag = await dragCard(page, dx);
      await drag.release();
      // Wait for the server's answer: a mutual like opens the match dialog,
      // which must be closed before the next drag can reach the card.
      const response = await swipeDone;
      if ((await response.json()).matched) await dismissMatch(page);
      await expect.poll(() => topName(page)).not.toBe(before);
    }
  });

  test("a short drag snaps back without swiping", async ({ page }) => {
    await openDiscover(page);
    const before = await topName(page);
    let swipeRequests = 0;
    page.on("request", (r) => r.url().endsWith("/swipe") && swipeRequests++);

    const drag = await dragCard(page, 40);
    await page.waitForTimeout(300); // let the flick velocity settle to zero
    await drag.release();
    await page.waitForTimeout(700);

    expect(await topName(page)).toBe(before);
    expect(swipeRequests).toBe(0);
    // A drag is not a tap: the info is still showing.
    await expect(card(page).locator("h2")).toBeVisible();
  });

  test("arrow keys swipe on desktop", async ({ page }) => {
    await openDiscover(page);
    const first = await topName(page);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => topName(page)).not.toBe(first);
    const second = await topName(page);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => topName(page)).not.toBe(second);
  });

  test("a swiped profile never comes back, even after a reload", async ({
    page,
  }) => {
    await openDiscover(page);
    const swiped: string[] = [];
    for (const action of ["pass", "like", "pass"] as const) {
      swiped.push((await topName(page))!);
      await swipeWithButton(page, action);
      await expect.poll(() => topName(page)).not.toBe(swiped.at(-1));
    }

    await page.reload();
    await expect(card(page)).toBeVisible();
    expect(swiped).not.toContain(await topName(page));

    const feed = await page.request.get("/feed?limit=30");
    const names = (await feed.json()).profiles.map(
      (p: { name: string }) => p.name,
    );
    for (const name of swiped) expect(names).not.toContain(name);
  });
});

test.describe("matching", () => {
  test("liking everyone yields mutual matches, a caught-up state and a restart", async ({
    page,
  }) => {
    await openDiscover(page);

    // Swipe right on the whole deck. Only the people who already liked this
    // visitor can turn into matches; nothing in the UI says who they are.
    let matched = 0;
    let swipes = 0;
    while ((await topName(page)) !== null) {
      const result = await swipeWithButton(page, "like");
      swipes++;
      if (result.matched) matched++;
      expect(swipes).toBeLessThanOrEqual(40);
    }
    expect(swipes).toBeGreaterThanOrEqual(30);
    expect(matched).toBeGreaterThanOrEqual(8);
    expect(matched).toBeLessThanOrEqual(10);

    // Clear empty state.
    const caughtUp = page.getByTestId("caught-up");
    await expect(caughtUp).toBeVisible();
    await expect(caughtUp).toContainText("You're all caught up");

    // The header badge counts only mutual matches.
    await expect(page.getByTestId("match-count")).toHaveText(String(matched));

    // The Matches view lists exactly those, and survives a reload.
    await page.getByRole("link", { name: /^Matches/ }).click();
    await expect(page).toHaveURL(/\/discover\/matches$/);
    await expect(page.getByTestId("match-item")).toHaveCount(matched);
    await page.reload();
    await expect(page.getByTestId("match-item")).toHaveCount(matched);

    // Swipes persisted: the deck is still empty after a reload.
    await page.goto("/discover");
    await expect(page.getByTestId("caught-up")).toBeVisible();

    // Start over restores a fresh deck and clears matches.
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(card(page)).toBeVisible();
    await expect(page.getByTestId("match-count")).toHaveCount(0);
    await page.goto("/discover/matches");
    await expect(page.getByTestId("no-matches")).toBeVisible();
  });

  test("the match dialog announces itself and can be dismissed with Escape", async ({
    page,
  }) => {
    await openDiscover(page);
    // Like until the first mutual match.
    for (let i = 0; i < 40; i++) {
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().endsWith("/swipe") && r.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Like" }).click(),
      ]);
      if ((await response.json()).matched) break;
    }

    const dialog = page.getByRole("dialog", { name: /it.s a match/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("liked each other");
    await expect(
      dialog.getByRole("button", { name: "Keep swiping" }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("privacy", () => {
  test("the API never reveals who liked the visitor", async ({ page }) => {
    await openDiscover(page);

    const feed = await (await page.request.get("/feed?limit=30")).json();
    expect(Object.keys(feed).sort()).toEqual(["hasMore", "profiles"]);
    for (const profile of feed.profiles) {
      expect(Object.keys(profile).sort()).toEqual([
        "age",
        "bio",
        "id",
        "interests",
        "location",
        "name",
        "photoUrl",
      ]);
    }

    // Passing never matches, whoever the person is.
    for (const profile of feed.profiles.slice(0, 12)) {
      const response = await page.request.post("/swipe", {
        data: { profileId: profile.id, action: "pass" },
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ matched: false });
    }

    // Swipes are final, so the answer can't be re-rolled.
    const again = await page.request.post("/swipe", {
      data: { profileId: feed.profiles[0].id, action: "like" },
    });
    expect(again.status()).toBe(409);
    expect((await (await page.request.get("/matches")).json()).matches).toEqual(
      [],
    );
  });

  test("visitors never see each other's matches", async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const a = await first.newPage();
    const b = await second.newPage();
    await a.goto("/discover");
    await b.goto("/discover");

    // Visitor A likes through until a match exists.
    for (let i = 0; i < 40; i++) {
      const feed = await (await a.request.get("/feed?limit=1")).json();
      if (!feed.profiles[0]) break;
      const swipe = await (
        await a.request.post("/swipe", {
          data: { profileId: feed.profiles[0].id, action: "like" },
        })
      ).json();
      if (swipe.matched) break;
    }
    expect(
      (await (await a.request.get("/matches")).json()).matches.length,
    ).toBe(1);
    expect((await (await b.request.get("/matches")).json()).matches).toEqual(
      [],
    );

    await first.close();
    await second.close();
  });
});
