const { test, expect } = require("@playwright/test");
const catalog = require("../src/data/liveTV.catalog.json");
const ids = page => page.locator(".experience-choice").evaluateAll(nodes => nodes.map(node => node.dataset.contentId));
const expectedIds = ["channel-live-TVfromtheDanishParliament.dk-SD", "channel-live-UNWebTV.us-SD"];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

test("TV and channel search expose exactly the two supported records with no external-only replacements", async ({ page }) => {
  expect(catalog.entries).toHaveLength(2);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const url of ["/livetv", "/search?type=channel"]) {
      await page.goto(url);
      expect(await ids(page)).toEqual(expectedIds);
      await expect(page.locator(".official-watch-card")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Watch on Official Website", exact: true })).toHaveCount(0);
    }
  }
});

test("unknown channel IDs recover the supported catalog without mounting a player", async ({ page }) => {
  for (const id of ["channel-missing", "channel-live-Unknown.example-SD", "not-a-channel"]) {
    await page.goto(`/livetv/${id}?watch=1`);
    expect(await ids(page)).toEqual(expectedIds);
    await expect(page.locator("video,iframe,.experience-player-overlay")).toHaveCount(0);
  }
});

test("an unauthenticated viewer can browse TV and is asked to log in before saving a favorite", async ({ page }) => {
  const entry = catalog.entries[0];
  await page.goto(`/livetv/${expectedIds[0]}`);
  await page.getByRole("button", { name: `Add ${entry.name} to My list`, exact: true }).last().click();
  await expect(page.getByRole("dialog", { name: "Login", exact: true })).toBeVisible();
});
