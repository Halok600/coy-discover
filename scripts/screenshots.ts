/**
 * Regenerates the README screenshots from a running instance.
 *
 *   npm run build && npm start        # in one terminal
 *   BASE_URL=http://localhost:3000 npm run screenshots
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";

async function imagesLoaded(page: Page) {
  await page.waitForFunction(() =>
    [...document.images].every((img) => img.complete && img.naturalWidth > 0),
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();

  // 1. The deck.
  await page.goto(`${BASE_URL}/discover`);
  await page.getByTestId("swipe-card").waitFor();
  await imagesLoaded(page);
  await page.screenshot({ path: `${OUT}/discover.png` });

  // 1b. Expanded details, then photo only (tap the bare photo).
  const photoSpot = { position: { x: 50, y: 100 } };
  await page.getByRole("button", { name: /^More about/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/details.png` });
  await page.getByTestId("swipe-card").click(photoSpot);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/photo-only.png` });
  await page.getByTestId("swipe-card").click(photoSpot); // back to the strip
  await page.waitForTimeout(500);

  // 2. Mid-drag, with the LIKE stamp showing.
  const box = (await page.getByTestId("swipe-card").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 70, cy + 10, { steps: 8 });
  await page.mouse.move(cx + 100, cy + 14, { steps: 8 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/drag-like.png` });
  await page.mouse.move(cx, cy, { steps: 8 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(700);

  // 3. Like until the first mutual match.
  for (let i = 0; i < 40; i++) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith("/swipe") && r.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Like" }).click(),
    ]);
    if (((await response.json()) as { matched: boolean }).matched) break;
  }
  await page.getByTestId("match-modal").waitFor();
  await imagesLoaded(page);
  await page.waitForTimeout(350); // catch the confetti mid-flight
  await page.screenshot({ path: `${OUT}/match.png` });

  // 4. The Matches list.
  await page.getByRole("button", { name: "Keep swiping" }).click();
  await page.goto(`${BASE_URL}/discover/matches`);
  await page.getByTestId("match-item").first().waitFor();
  await imagesLoaded(page);
  await page.screenshot({ path: `${OUT}/matches.png` });

  // 5. Caught up: swipe through the rest through the API.
  for (;;) {
    const feed = (await (
      await page.request.get(`${BASE_URL}/feed?limit=30`)
    ).json()) as {
      profiles: { id: string }[];
    };
    if (feed.profiles.length === 0) break;
    for (const { id } of feed.profiles) {
      await page.request.post(`${BASE_URL}/swipe`, {
        data: { profileId: id, action: "pass" },
      });
    }
  }
  await page.goto(`${BASE_URL}/discover`);
  await page.getByTestId("caught-up").waitFor();
  await page.screenshot({ path: `${OUT}/caught-up.png` });

  await browser.close();
  console.log(`Screenshots written to ${OUT}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
