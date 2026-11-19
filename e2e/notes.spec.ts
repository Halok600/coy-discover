import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { dismissMatch, openDiscover, topName } from "./helpers";

const writeNote = (page: Page) =>
  page.getByRole("button", { name: "Write a note" });
const sheet = (page: Page) => page.getByTestId("note-sheet");
const modal = (page: Page) => page.getByTestId("match-modal");

type SwipeBody = {
  matched: boolean;
  match?: { yourNote: string | null; theirNote: string | null };
};

/** Opens the note sheet, writes a note, and sends the like with it. */
async function likeWithNote(page: Page, note: string) {
  await writeNote(page).click();
  await sheet(page).getByRole("textbox").fill(note);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/swipe") && r.request().method() === "POST",
    ),
    sheet(page).getByRole("button", { name: "Like with note" }).click(),
  ]);
  await expect(sheet(page)).toBeHidden();
  return {
    body: (await response.json()) as SwipeBody,
    sent: response.request().postDataJSON() as { note?: string },
  };
}

test.describe("writing a note", () => {
  test("the sheet opens, validates, and cancels without swiping", async ({
    page,
  }) => {
    await openDiscover(page);
    let swipes = 0;
    page.on("request", (r) => r.url().endsWith("/swipe") && swipes++);
    const before = await topName(page);

    await writeNote(page).click();
    await expect(sheet(page)).toBeVisible();
    const submit = sheet(page).getByRole("button", { name: "Like with note" });
    await expect(submit).toBeDisabled(); // nothing to send yet
    await expect(sheet(page)).toContainText("0/140");

    await sheet(page).getByRole("textbox").fill("   "); // whitespace only
    await expect(submit).toBeDisabled();

    await sheet(page).getByRole("textbox").fill("Coffee after the fest?");
    await expect(submit).toBeEnabled();
    await expect(sheet(page)).toContainText("22/140");

    await sheet(page).getByRole("button", { name: "Cancel" }).click();
    await expect(sheet(page)).toBeHidden();
    expect(swipes).toBe(0);
    expect(await topName(page)).toBe(before);
  });

  test("Escape closes the sheet and returns focus to the button", async ({
    page,
  }) => {
    await openDiscover(page);
    await writeNote(page).focus();
    await page.keyboard.press("Enter");
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole("textbox")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(writeNote(page)).toBeFocused();
  });

  test("Tab stays inside the sheet", async ({ page }) => {
    await openDiscover(page);
    await writeNote(page).click();
    await sheet(page).getByRole("textbox").fill("hello");
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const inside = await sheet(page).evaluate((el) =>
        el.contains(document.activeElement),
      );
      expect(inside, `Tab #${i + 1} left the sheet`).toBe(true);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await sheet(page).evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
  });

  test("arrow keys edit the text and never swipe the card behind", async ({
    page,
  }) => {
    await openDiscover(page);
    let swipes = 0;
    page.on("request", (r) => r.url().endsWith("/swipe") && swipes++);
    const before = await topName(page);

    await writeNote(page).click();
    await sheet(page).getByRole("textbox").fill("abc");
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowLeft"]) {
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(500);
    expect(swipes).toBe(0);
    expect(await topName(page)).toBe(before);
  });

  test("text is clamped at 140 characters, and an emoji counts as one", async ({
    page,
  }) => {
    await openDiscover(page);
    await writeNote(page).click();
    const box = sheet(page).getByRole("textbox");

    await box.fill("x".repeat(200));
    await expect(sheet(page)).toContainText("140/140");
    expect((await box.inputValue()).length).toBe(140);

    await box.fill("\u{1F600}".repeat(150));
    await expect(sheet(page)).toContainText("140/140");
    expect([...(await box.inputValue())].length).toBe(140);
  });

  test("sends the note with the like and moves on to the next card", async ({
    page,
  }) => {
    await openDiscover(page);
    const before = await topName(page);
    const { sent } = await likeWithNote(page, "  Coffee   after the fest?  ");

    // The wire carries what was typed (the server normalizes it).
    expect(sent.note).toBe("  Coffee   after the fest?  ");
    await expect.poll(() => topName(page)).not.toBe(before);
  });

  test("a failed save returns the card and keeps what you wrote", async ({
    page,
  }) => {
    await openDiscover(page);
    const before = await topName(page);
    await page.route("**/swipe", (route) => route.abort("failed"));

    await writeNote(page).click();
    await sheet(page).getByRole("textbox").fill("Don't lose me");
    await sheet(page).getByRole("button", { name: "Like with note" }).click();

    await expect(page.getByText(/Couldn.t save that swipe/)).toBeVisible();
    await expect.poll(() => topName(page)).toBe(before);

    await writeNote(page).click();
    await expect(sheet(page).getByRole("textbox")).toHaveValue("Don't lose me");
  });
});

test.describe("what the other person sees (only on a match)", () => {
  test("a match shows their sealed note and yours, in the dialog and in Matches, and survives a reload", async ({
    page,
  }) => {
    await openDiscover(page);

    let result: Awaited<ReturnType<typeof likeWithNote>> | undefined;
    for (let i = 0; i < 32; i++) {
      result = await likeWithNote(page, `Hello number ${i}`);
      if (result.body.matched) break;
    }
    expect(result?.body.matched).toBe(true);
    const match = result!.body.match!;
    expect(match.yourNote).toBe(result!.sent.note);
    expect(match.theirNote).toBeTruthy();

    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator("figcaption")).toContainText("wrote");
    await expect(modal(page).locator("blockquote")).toHaveText(
      match.theirNote!,
    );
    await expect(modal(page)).toContainText(`You wrote: “${match.yourNote}”`);

    await dismissMatch(page);
    await page.getByRole("link", { name: /^Matches/ }).click();
    const item = page.getByTestId("match-item").first();
    await expect(item).toContainText(`“${match.theirNote}”`);
    await page.reload();
    await expect(page.getByTestId("match-item").first()).toContainText(
      `“${match.theirNote}”`,
    );
  });

  test("a like without a note still matches and shows only their note", async ({
    page,
  }) => {
    await openDiscover(page);
    let body: SwipeBody | undefined;
    for (let i = 0; i < 32 && !body?.matched; i++) {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/swipe")),
        page.getByRole("button", { name: "Like", exact: true }).click(),
      ]);
      body = (await response.json()) as SwipeBody;
    }
    expect(body?.matched).toBe(true);
    expect(body?.match?.yourNote).toBeNull();
    await expect(modal(page).locator("blockquote")).toHaveText(
      body!.match!.theirNote!,
    );
    await expect(modal(page)).not.toContainText("You wrote");
  });

  test("a note on a one-sided like is never shown, sent back, or stored where anyone can read it", async ({
    page,
  }) => {
    await openDiscover(page);
    const bodies: string[] = [];
    page.on("response", async (response) => {
      const path = new URL(response.url()).pathname;
      if (/^\/(swipe|feed|matches)$/.test(path)) {
        bodies.push(await response.text().catch(() => ""));
      }
    });

    // Send notes until one lands on someone who had not liked us.
    let secret = "";
    for (let i = 0; i < 32 && !secret; i++) {
      const note = `SECRET-ONE-SIDED-${i}`;
      const { body } = await likeWithNote(page, note);
      if (body.matched) await dismissMatch(page);
      else secret = note;
    }
    expect(secret, "found a non-match to test with").not.toBe("");

    // Look everywhere: the deck, the Matches page, and the raw API.
    await page.goto("/discover/matches");
    await page.waitForTimeout(500);
    await page.goto("/discover");
    await page.request.get("/feed?limit=30");
    await page.request.get("/matches");
    await expect(page.locator("body")).not.toContainText(secret);
    for (const body of bodies) expect(body).not.toContain(secret);
    const direct = [
      await (await page.request.get("/feed?limit=30")).text(),
      await (await page.request.get("/matches")).text(),
    ];
    for (const text of direct) expect(text).not.toContain(secret);
  });
});

test.describe("hostile and extreme note text", () => {
  const hostile =
    "<img src=x onerror=window.__xss=1><script>window.__xss=1</script>";

  async function mockMatch(page: Page, theirNote: string, yourNote: string) {
    const feed = await (await page.request.get("/feed?limit=1")).json();
    await page.route("**/swipe", (route) =>
      route.fulfill({
        json: {
          matched: true,
          match: {
            id: "m",
            matchedAt: new Date().toISOString(),
            profile: feed.profiles[0],
            theirNote,
            yourNote,
          },
        },
      }),
    );
  }

  test("notes are shown as text, never run as code", async ({ page }) => {
    await openDiscover(page);
    await mockMatch(page, hostile, hostile);
    await page.getByRole("button", { name: "Like", exact: true }).click();

    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator("blockquote")).toHaveText(hostile);
    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined();
    // No element was created from the note's markup.
    await expect(modal(page).locator("img[src='x'], script")).toHaveCount(0);
  });

  for (const viewport of [
    { width: 320, height: 480 },
    { width: 667, height: 375 },
    { width: 390, height: 844 },
  ]) {
    test(`long unbroken notes fit and stay reachable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openDiscover(page);
      await mockMatch(page, "W".repeat(140), "\u{1F600}".repeat(140));
      await page
        .getByRole("button", { name: "Like", exact: true })
        .scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "Like", exact: true }).click();
      await expect(modal(page)).toBeVisible();
      await page.waitForTimeout(600);

      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
      const quote = (await modal(page).locator("blockquote").boundingBox())!;
      expect(quote.x).toBeGreaterThanOrEqual(0);
      expect(quote.x + quote.width).toBeLessThanOrEqual(viewport.width + 1);

      for (const target of [
        modal(page).getByRole("link", { name: "See matches" }),
        modal(page).getByRole("button", { name: "Keep swiping" }),
      ]) {
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport({ ratio: 0.99 });
      }
    });
  }

  for (const viewport of [
    { width: 320, height: 480 },
    { width: 667, height: 375 },
  ]) {
    test(`the note sheet is usable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openDiscover(page);
      await writeNote(page).scrollIntoViewIfNeeded();
      await writeNote(page).click();
      await sheet(page).getByRole("textbox").fill("x".repeat(140));

      for (const name of ["Cancel", "Like with note"]) {
        const button = sheet(page).getByRole("button", { name });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport({ ratio: 0.99 });
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe("notes in the Matches list", () => {
  for (const width of [320, 390]) {
    test(`a long unbroken note wraps instead of widening the list at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      const feed = await (await page.request.get("/feed?limit=3")).json();
      // Only the API call: "**/matches" would also catch the page itself.
      await page.route(
        (url) => url.pathname === "/matches",
        (route) =>
          route.fulfill({
            json: {
              matches: feed.profiles.map((profile: unknown, i: number) => ({
                id: `m${i}`,
                matchedAt: new Date().toISOString(),
                profile,
                theirNote: i === 0 ? "W".repeat(140) : "\u{1F600}".repeat(140),
                yourNote: null,
              })),
            },
          }),
      );
      await page.goto("/discover/matches");
      await expect(page.getByTestId("match-item")).toHaveCount(3);

      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
      for (const item of await page.getByTestId("match-item").all()) {
        const box = (await item.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      }
    });
  }
});

test.describe("accessibility of the new screens", () => {
  async function expectAccessible(page: Page, label: string) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      violations.map((v) => ({
        rule: v.id,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
      })),
      `axe violations on: ${label}`,
    ).toEqual([]);
  }

  test("the note sheet (empty and filled)", async ({ page }) => {
    await openDiscover(page);
    await writeNote(page).click();
    await expect(sheet(page)).toBeVisible();
    await expectAccessible(page, "note sheet (empty)");
    await sheet(page).getByRole("textbox").fill("x".repeat(130));
    await expectAccessible(page, "note sheet (near the limit)");
  });

  test("the match dialog and Matches list with notes", async ({ page }) => {
    await openDiscover(page);
    let matched = false;
    for (let i = 0; i < 32 && !matched; i++) {
      matched = (await likeWithNote(page, `Hi ${i}`)).body.matched;
    }
    await expect(modal(page)).toBeVisible();
    await page.waitForTimeout(1500);
    await expectAccessible(page, "match dialog with notes");
    await dismissMatch(page);
    await page.goto("/discover/matches");
    await expect(page.getByTestId("match-item").first()).toBeVisible();
    await expectAccessible(page, "Matches with notes");
  });
});
