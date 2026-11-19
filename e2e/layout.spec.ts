import { expect, test } from "./fixtures";
import { card, openDiscover } from "./helpers";

/** Real-world screen sizes, from a tiny old phone to a big desktop. */
const SCREENS = [
  { name: "320x480 tiny phone", width: 320, height: 480 },
  { name: "320x568 iPhone SE 1st gen", width: 320, height: 568 },
  { name: "360x640 small Android", width: 360, height: 640 },
  { name: "375x667 iPhone 8", width: 375, height: 667 },
  { name: "390x844 iPhone 14", width: 390, height: 844 },
  { name: "412x915 Pixel", width: 412, height: 915 },
  { name: "667x375 phone landscape", width: 667, height: 375 },
  { name: "768x1024 tablet", width: 768, height: 1024 },
  { name: "1024x768 tablet landscape", width: 1024, height: 768 },
  { name: "1440x900 desktop", width: 1440, height: 900 },
];

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } });

    test("everything fits, is reachable, and is big enough to use", async ({
      page,
    }, testInfo) => {
      await openDiscover(page);
      await page.waitForTimeout(400);
      await testInfo.attach("screenshot", {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      const viewport = page.viewportSize()!;

      // No sideways scrolling.
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth, "horizontal overflow").toBeLessThanOrEqual(
        overflow.innerWidth,
      );

      const box = async (locator: ReturnType<typeof page.locator>) =>
        (await locator.boundingBox())!;

      // The card is usable: tall enough to show a face, and on screen.
      const cardBox = await box(card(page));
      expect(cardBox.height, "card height").toBeGreaterThanOrEqual(260);
      expect(cardBox.width, "card width").toBeGreaterThanOrEqual(240);
      expect(cardBox.x).toBeGreaterThanOrEqual(0);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width);

      // The controls and tab bar can be reached (page scroll is allowed on
      // very short screens, so scroll them into view first).
      const like = page.getByRole("button", { name: "Like" });
      const pass = page.getByRole("button", { name: "Pass" });
      const tabs = page.getByRole("navigation", { name: "Main" });
      for (const locator of [like, pass, tabs]) {
        await locator.scrollIntoViewIfNeeded();
        await expect(locator).toBeInViewport({ ratio: 0.99 });
      }

      // Nothing overlaps the controls, and they are big enough to tap.
      await like.scrollIntoViewIfNeeded();
      const [likeBox, passBox, tabsBox] = [
        await box(like),
        await box(pass),
        await box(tabs),
      ];
      expect(passBox.x + passBox.width).toBeLessThanOrEqual(likeBox.x);
      expect(likeBox.y + likeBox.height).toBeLessThanOrEqual(tabsBox.y + 1);
      for (const target of [likeBox, passBox]) {
        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }

      // The controls actually receive the click (nothing is stacked on top).
      const topElement = await like.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return el === hit || el.contains(hit);
      });
      expect(topElement, "Like button is covered by something").toBe(true);
    });

    test("swiping still works at this size", async ({ page }) => {
      await openDiscover(page);
      const heading = card(page).locator("h2");
      const before = await heading.innerText();
      await page.getByRole("button", { name: "Pass" }).scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Pass" }).click();
      await expect(heading).not.toHaveText(before);
    });

    test("the match dialog fits and its buttons are reachable", async ({
      page,
    }) => {
      await openDiscover(page);
      const profile = await (await page.request.get("/feed?limit=1")).json();
      await page.route("**/swipe", (route) =>
        route.fulfill({
          json: {
            matched: true,
            match: {
              id: "m",
              matchedAt: new Date().toISOString(),
              profile: profile.profiles[0],
            },
          },
        }),
      );
      await page.getByRole("button", { name: "Like" }).scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Like" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(600); // let the spring settle
      for (const name of ["See matches", "Keep swiping"]) {
        const target = dialog.getByRole(
          name === "See matches" ? "link" : "button",
          { name },
        );
        await expect(target).toBeInViewport({ ratio: 0.99 });
      }
      const viewport = page.viewportSize()!;
      const d = (await dialog.getByRole("heading").boundingBox())!;
      expect(d.x).toBeGreaterThanOrEqual(-1);
      expect(d.x + d.width).toBeLessThanOrEqual(viewport.width + 1);
    });
  });
}
