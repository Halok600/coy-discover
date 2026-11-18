import { expect, type Page } from "@playwright/test";

export const card = (page: Page) => page.getByTestId("swipe-card");

/** The visible name on the top card, or null when the deck is empty. */
export async function topName(page: Page): Promise<string | null> {
  const heading = card(page).locator("h2");
  if ((await heading.count()) === 0) return null;
  // The heading reads "Name 24"; strip the age.
  return (await heading.innerText()).replace(/\s*\d+\s*$/, "").trim();
}

export async function openDiscover(page: Page) {
  await page.goto("/discover");
  await expect(card(page)).toBeVisible();
}

export async function dismissMatch(page: Page) {
  const modal = page.getByTestId("match-modal");
  await expect(modal).toBeVisible();
  await page.getByRole("button", { name: "Keep swiping" }).click();
  await expect(modal).toBeHidden();
}

type SwipeResponse = { matched: boolean };

/**
 * Swipes with the on-screen button, waits for the server's answer and, if it
 * was a match, dismisses the "It's a match!" dialog. Returns the response.
 */
export async function swipeWithButton(
  page: Page,
  action: "like" | "pass",
): Promise<SwipeResponse> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/swipe") && r.request().method() === "POST",
    ),
    page
      .getByRole("button", { name: action === "like" ? "Like" : "Pass" })
      .click(),
  ]);
  const body = (await response.json()) as SwipeResponse;
  if (body.matched) await dismissMatch(page);
  return body;
}

/** Drags the top card horizontally by `dx` pixels with the mouse. */
export async function dragCard(page: Page, dx: number) {
  const box = await card(page).boundingBox();
  if (!box) throw new Error("No card to drag");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 6 });
  await page.mouse.move(x + dx, y, { steps: 6 });
  return {
    release: () => page.mouse.up(),
  };
}
