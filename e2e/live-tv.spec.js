const { test, expect } = require("@playwright/test");
const catalog = require("../src/data/liveTV.catalog.json");

const danish = catalog.entries.find(entry => entry.channelId === "TVfromtheDanishParliament.dk");
const un = catalog.entries.find(entry => entry.channelId === "UNWebTV.us");
const publicId = entry => `channel-live-${entry.channelId}-${entry.feedId}`;
const ids = page => page.locator(".experience-choice").evaluateAll(nodes => nodes.map(node => node.dataset.contentId));
const player = (page, entry) => page.getByRole("region", { name: `${entry.name} player`, exact: true });

// These tests exercise actual UI, routing and licence presentation with provider
// requests blocked. They do not assert that a broadcaster is currently online.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

test("the two retained TV covers load on desktop, portrait phones and landscape phones", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [667, 375]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/livetv");
    await expect(page.getByRole("heading", { name: "Live TV", exact: true, level: 1 })).toBeVisible();
    expect(await ids(page)).toEqual(catalog.entries.map(publicId));
    const cards = page.locator(".poster-tile");
    await expect(cards).toHaveCount(2);
    for (const card of await cards.all()) {
      await expect.poll(() => card.locator("img").evaluateAll(images => images.length === 1 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
      await expect(card).toHaveAttribute("data-artwork-kind", "editorial-illustration");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("contentinfo", { name: "End of collection", exact: true })).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test("each retained channel is independently searchable and opens a shareable playback URL", async ({ page }) => {
  for (const entry of catalog.entries) {
    await page.goto(`/search?type=channel&q=${encodeURIComponent(entry.name)}`);
    const search = page.getByRole("dialog", { name: "Search", exact: true });
    await search.getByRole("button", { name: "Show results", exact: true }).click();
    await expect(search).toHaveCount(0);
    expect(await ids(page)).toEqual([publicId(entry)]);
    // Desktop poster actions live in the expanded hover preview.
    await page.getByRole("group", { name: `${entry.name} poster`, exact: true }).hover();
    const preview = page.getByRole("region", { name: `${entry.name} preview`, exact: true });
    await expect(preview).toBeVisible();
    await preview.getByRole("button", { name: `Play ${entry.name}`, exact: true }).click();
    // Playback opened from Search retains its search context in a shareable URL.
    await expect.poll(() => new URL(page.url()).searchParams.get("selected")).toBe(publicId(entry));
    expect(new URL(page.url()).searchParams.get("watch")).toBe("1");
    await page.reload();
    await expect(player(page, entry)).toBeVisible();
    await expect(page.getByRole("button", { name: `Add ${entry.name} to My list`, exact: true }).last()).toBeVisible();
  }
});

test("Danish playback keeps the unchanged licence accessible and all app controls outside its picture", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/livetv/${publicId(danish)}`);
    const region = player(page, danish);
    await expect(region).toHaveClass(/no-overlays/);
    await expect(region.locator(".player-stage .video-controls,.player-stage .player-heading,.player-stage .player-preview,.player-stage button")).toHaveCount(0);
    const video = region.locator("video");
    await expect(video).toHaveCount(1);
    expect(await video.evaluate(media => ({ objectFit: getComputedStyle(media).objectFit, filter: getComputedStyle(media).filter })))
      .toEqual({ objectFit: "contain", filter: "none" });
    const rights = page.getByRole("region", { name: "License & Rights", exact: true });
    await expect(rights.getByRole("link", { name: /Official license/ })).toHaveAttribute("href", danish.permission.fullLicenseUrl);
    await rights.locator("summary").click();
    await expect(rights.getByRole("region", { name: "Complete license text", exact: true })).toHaveText(danish.permission.fullLicenseText);
    const credit = page.locator(".playback-details .title-details-credits");
    await expect(credit).toContainText("Folketinget (Danish Parliament)");
    await expect(credit).not.toContainText("Keep every Krispy control");
    const geometry = await region.evaluate(element => {
      const picture = element.querySelector("video").getBoundingClientRect();
      const controls = element.querySelector(".video-controls").getBoundingClientRect();
      return { pictureBottom: picture.bottom, controlsTop: controls.top };
    });
    expect(geometry.controlsTop).toBeGreaterThanOrEqual(geometry.pictureBottom - 1);
  }
  const region = player(page, danish);
  await region.getByRole("button", { name: "Enter fullscreen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(region.getByRole("region", { name: "Source and complete licence", exact: true })).toContainText(danish.permission.fullLicenseText);
  await page.evaluate(() => document.exitFullscreen());
});

test("UN keeps its exact official iframe and the channel rail switches only between the two sources", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/livetv/${publicId(un)}`);
  const iframe = page.getByTitle(`${un.name} player`, { exact: true });
  await expect(iframe).toHaveAttribute("src", new URL(un.playback.url).href);
  await expect(iframe).toHaveAttribute("tabindex", "0");
  const rail = page.getByRole("complementary", { name: "TV channels", exact: true });
  await expect(rail.getByRole("button", { name: /^Watch / })).toHaveCount(2);
  await rail.getByRole("button", { name: `Watch ${danish.name}`, exact: true }).click();
  await expect(player(page, danish).locator("video")).toHaveCount(1);
  await expect(iframe).toHaveCount(0);
  await rail.getByRole("button", { name: `Watch ${un.name}`, exact: true }).click();
  await expect(iframe).toHaveAttribute("src", new URL(un.playback.url).href);
  await expect(page.locator("video")).toHaveCount(0);
});
