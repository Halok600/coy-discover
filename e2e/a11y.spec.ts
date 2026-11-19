import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { card, openDiscover } from "./helpers";

/** Runs axe against WCAG 2.0/2.1 A and AA and fails with a readable list. */
async function expectAccessible(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    detail: v.nodes[0]?.failureSummary?.split("\n").slice(0, 3).join(" | "),
  }));
  expect(summary, `accessibility violations on: ${label}`).toEqual([]);
}

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  test("Home", async ({ page }) => {
    await page.goto("/");
    await expectAccessible(page, "Home");
  });

  test("Discover: compact, details and photo-only card states", async ({
    page,
  }) => {
    await openDiscover(page);
    await page.waitForTimeout(500);
    await expectAccessible(page, "Discover (compact)");

    await card(page)
      .getByRole("button", { name: /^More about/ })
      .click();
    await page.waitForTimeout(500);
    await expectAccessible(page, "Discover (details)");

    await card(page)
      .getByRole("button", { name: /^Less about/ })
      .click();
    await card(page)
      .getByRole("button", { name: "Hide details to see the photo" })
      .click();
    await page.waitForTimeout(500);
    await expectAccessible(page, "Discover (photo only)");
  });

  test("Discover: loading and error states", async ({ page }) => {
    test.info().annotations.push({ type: "allow-errors" });
    await page.route(/\/feed(\?|$)/, (route) => route.abort("failed"));
    await page.goto("/discover");
    await expect(
      page.getByText("Couldn't load profiles").first(),
    ).toBeVisible();
    await expectAccessible(page, "Discover (error)");
  });

  test("Discover: the match dialog", async ({ page }) => {
    await openDiscover(page);
    const feed = await (await page.request.get("/feed?limit=1")).json();
    await page.route("**/swipe", (route) =>
      route.fulfill({
        json: {
          matched: true,
          match: {
            id: "m",
            matchedAt: new Date().toISOString(),
            profile: feed.profiles[0],
          },
        },
      }),
    );
    await page.getByRole("button", { name: "Like" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(1500); // confetti done
    await expectAccessible(page, "match dialog");
  });

  test("Discover: caught up, and Matches (empty and with items)", async ({
    page,
  }) => {
    // Matches, empty.
    await page.goto("/discover/matches");
    await expect(page.getByTestId("no-matches")).toBeVisible();
    await expectAccessible(page, "Matches (empty)");

    // Swipe everyone through the API: caught up, with matches.
    for (;;) {
      const feed = await (await page.request.get("/feed?limit=30")).json();
      if (feed.profiles.length === 0) break;
      for (const profile of feed.profiles) {
        await page.request.post("/swipe", {
          data: { profileId: profile.id, action: "like" },
        });
      }
    }
    await page.goto("/discover");
    await expect(page.getByTestId("caught-up")).toBeVisible();
    await expectAccessible(page, "Discover (caught up)");

    await page.goto("/discover/matches");
    await expect(page.getByTestId("match-item").first()).toBeVisible();
    await page.waitForTimeout(400);
    await expectAccessible(page, "Matches (with items)");
  });
});
