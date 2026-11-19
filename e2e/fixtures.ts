import { expect, test as base } from "@playwright/test";

/**
 * Every test fails if the app throws an uncaught error, logs a console error,
 * or the server answers 5xx to the page. Tests that inject failures on purpose
 * opt out with `test.info().annotations.push({ type: "allow-errors" })`.
 */
export const test = base.extend<{ errorWatch: void }>({
  errorWatch: [
    async ({ page, baseURL }, use, testInfo) => {
      const problems: string[] = [];
      page.on("pageerror", (error) =>
        problems.push(`pageerror: ${error.message}`),
      );
      page.on("console", (message) => {
        // Failed resource loads (a deliberate 409, a blocked image) are
        // reported separately below; everything else must be clean.
        if (
          message.type() === "error" &&
          !/Failed to load resource/.test(message.text())
        ) {
          problems.push(`console.error: ${message.text()}`);
        }
      });
      page.on("response", (response) => {
        if (baseURL && response.url().startsWith(baseURL)) {
          if (response.status() >= 500) {
            problems.push(`${response.status()} from ${response.url()}`);
          }
        }
      });

      await use();

      const allowed = testInfo.annotations.some(
        (a) => a.type === "allow-errors",
      );
      if (!allowed) expect(problems, "browser/server errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
