const { defineConfig } = require("@playwright/test");
const testURL = process.env.KRISPY_TEST_BASE_URL || "http://127.0.0.1:3002";
module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: testURL,
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: process.env.KRISPY_BROWSER_PATH
      ? { executablePath: process.env.KRISPY_BROWSER_PATH }
      : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start:public",
    url: testURL,
    reuseExistingServer: true,
    timeout: 90000,
    env: { BROWSER: "none", HOST: "127.0.0.1", PORT: "3002" },
  },
});
