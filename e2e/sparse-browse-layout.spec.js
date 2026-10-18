const { test, expect } = require("@playwright/test");

const pages = [
  { path: "/livetv", heading: "Live TV", count: "2 channels", zero: "0 channels", ids: ["channel-live-TVfromtheDanishParliament.dk-SD", "channel-live-UNWebTV.us-SD"] },
  { path: "/liveglobe", heading: "Globe", count: "2 places", zero: "0 places", ids: ["destination-abisko", "destination-alveus-sanctuary"] },
];
const wall = page => page.getByRole("region", { name: "Title chooser", exact: true });
const footer = page => page.getByRole("contentinfo", { name: "End of collection", exact: true });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

async function inspectBrowse(page, section) {
  await expect(wall(page).getByRole("heading", { name: section.heading, exact: true, level: 1 })).toBeVisible();
  await expect(wall(page).getByText(section.count, { exact: true })).toBeVisible();
  await expect(footer(page)).toHaveCount(1);
  const cards = wall(page).locator(".poster-tile");
  await expect(cards).toHaveCount(section.ids.length);
  expect(await cards.evaluateAll(elements => elements.map(element => element.dataset.contentId).sort())).toEqual([...section.ids].sort());
  for (const card of await cards.all()) {
    await expect.poll(() => card.locator("img").evaluateAll(images => images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    if (section.heading === "Globe") {
      const caption = card.locator(".poster-location-title");
      await expect(caption).toBeVisible();
      await expect(caption.locator(".poster-location-meta")).toBeVisible();
      expect(await caption.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
      const cardBounds = await card.boundingBox();
      const captionBounds = await caption.boundingBox();
      expect(captionBounds.x).toBeGreaterThanOrEqual(cardBounds.x);
      expect(captionBounds.x + captionBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width + 1);
      expect(captionBounds.y + captionBounds.height).toBeLessThanOrEqual(cardBounds.y + cardBounds.height + 1);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await wall(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const finalCard = await cards.last().boundingBox();
  const foot = await footer(page).boundingBox();
  expect(foot.y).toBeGreaterThanOrEqual(finalCard.y + finalCard.height - 1);
}

async function expectFooterAtRest(page) {
  await wall(page).evaluate(element => { element.scrollTop = element.scrollHeight; });
  const foot = await footer(page).boundingBox();
  expect(Math.abs(foot.y + foot.height - page.viewportSize().height)).toBeLessThanOrEqual(1);
  await expect(footer(page).getByRole("button", { name: "Back to top", exact: true })).toBeVisible();
}

for (const section of pages) {
  test(`${section.heading} places a single footer at the viewport bottom when desktop content is sparse`, async ({ page }, testInfo) => {
    for (const [width, height] of [[1440, 900], [1880, 920]]) {
      await page.setViewportSize({ width, height });
      await page.goto(section.path);
      await inspectBrowse(page, section);
      expect(await wall(page).evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
      const foot = await footer(page).boundingBox();
      expect(Math.abs(foot.y + foot.height - height)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`${section.heading.replace(/ /g, "-").toLowerCase()}-${width}x${height}.png`) });
    }
  });

  test(`${section.heading} maintains content order, reachable footer, and back-to-top focus on small screens`, async ({ page }, testInfo) => {
    for (const [width, height] of [[390, 844], [850, 440]]) {
      await page.setViewportSize({ width, height });
      await page.goto(section.path);
      await inspectBrowse(page, section);
      const fits = await wall(page).evaluate(element => element.scrollHeight <= element.clientHeight + 1);
      if (fits) {
        const foot = await footer(page).boundingBox();
        expect(Math.abs(foot.y + foot.height - height)).toBeLessThanOrEqual(1);
      }
      await expectFooterAtRest(page);
      await footer(page).getByRole("button", { name: "Back to top", exact: true }).click();
      await expect(wall(page).locator(".experience-choice").first()).toBeFocused();
      expect(await wall(page).evaluate(element => element.scrollTop)).toBe(0);
      await page.screenshot({ path: testInfo.outputPath(`${section.heading.replace(/ /g, "-").toLowerCase()}-${width}x${height}.png`) });
    }
  });

  test(`${section.heading} keeps the browse identity, empty state, and bottom footer after a filter matches nothing`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${section.path}?q=zz-no-matching-browse-result`);
    await expect(wall(page).getByRole("heading", { name: section.heading, exact: true, level: 1 })).toBeVisible();
    await expect(wall(page).getByText(section.zero, { exact: true })).toBeVisible();
    await expect(wall(page).getByText("No results", { exact: true })).toBeVisible();
    await expect(wall(page).locator(".poster-tile")).toHaveCount(0);
    await expect(footer(page)).toHaveCount(1);
    expect(await wall(page).evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await expectFooterAtRest(page);
  });
}
