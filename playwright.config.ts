import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      // Pure HTTP tests don't depend on the device, so run them once.
      testIgnore: /api-hostile/,
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Builds the app and serves it on an embedded database that is wiped first,
  // so every run starts from the seeded state and never touches dev data.
  webServer: {
    command: "npm run e2e:server",
    url: `${BASE_URL}/api/health`,
    timeout: 240_000,
    reuseExistingServer: !isCI,
    env: { PGLITE_DATA_DIR: ".data/e2e", DATABASE_URL: "" },
  },
});
