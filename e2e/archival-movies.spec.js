const { test, expect } = require("@playwright/test");
const { accountLibraryKey } = require("../src/lib/storage");
const { VIEWERS, interceptFirebase, login, choose } = require("./helpers/firebase");
const artifact = require("../src/data/archivalMovies.catalog.json");

// Expected IDs come from the reviewed artifact, independently of the adapter.
// External requests are blocked: these are UI regressions, not playback proof.
const entries = artifact.entries;
const movieId = (entry) => `film-archive-${entry.slug}`;
const archiveIds = entries.map(movieId);
const publicTVIds = [
  "channel-live-TVfromtheDanishParliament.dk-SD",
  "channel-live-UNWebTV.us-SD",
];
const nav = (page, name) => page.getByRole("navigation", { name: "Krispy menu" })
  .getByRole("button", { name, exact: true });
const displayedIds = (page) => page.locator(".experience-choice")
  .evaluateAll((nodes) => nodes.map((node) => node.dataset.contentId));
const tile = (page, entry) => page.locator(`.poster-tile[data-content-id="${movieId(entry)}"]`);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
      ? route.continue() : route.abort("blockedbyclient"));
});

async function action(page, name) {
  const button = page.getByRole("button", { name, exact: true }).first();
  await button.focus();
  await button.click();
}

async function collection(page, value) {
  await page.getByRole("combobox", { name: "Collection", exact: true }).selectOption(value);
}

async function horizontalBounds(page) {
  const bounds = await page.evaluate(() => ({ viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    wall: document.querySelector(".poster-wall")?.getBoundingClientRect().toJSON(),
    menu: document.querySelector(".side-menu")?.getBoundingClientRect().toJSON() }));
  expect(bounds.document).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.wall.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.wall.right).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.menu.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.menu.right).toBeLessThanOrEqual(bounds.viewport + 1);
}

test("the expanded archival library ships only reviewed, complete editions with saved actual playback", async ({ page }) => {
  expect(artifact.schemaVersion).toBe(1);
  expect(entries).toHaveLength(41);
  for (const entry of entries) {
    expect(entry.rights).toMatchObject({ reviewStatus: "qualified", territory: "US",
      edition: { reviewed: true, complete: true, newMaterialCleared: true } });
    expect(entry.savedPlayback).toMatchObject({ status: "passed", actualPlayer: true,
      userInitiated: true, pauseResumeVerified: true, sourceUrl: entry.source.url });
    expect(entry.savedPlayback.observationSeconds).toBeGreaterThanOrEqual(20);
    expect(entry.savedPlayback.currentTimeAdvanceSeconds).toBeGreaterThanOrEqual(10);
    expect(entry.savedPlayback.decodedFrames).toBeGreaterThan(0);
    expect(entry.savedPlayback.fatalErrors).toEqual([]);
    expect(entry.savedPlayback.significantStalls).toBe(0);
  }
  await page.goto("/?collection=archival");
  await expect(page.locator(".experience-choice")).toHaveCount(entries.length);
  expect(await displayedIds(page)).toEqual(archiveIds);
  await expect(page.locator(".poster-access-badge, video, iframe")).toHaveCount(0);
  for (const entry of entries) {
    await expect(tile(page, entry).getByRole("button", { name: `Select ${entry.title}`, exact: true })).toHaveCount(1);
    await expect(tile(page, entry).getByRole("button", { name: `Play ${entry.title}`, exact: true })).toHaveCount(1);
  }
});

test("classic features, shorts, recently added, genre filtering and film search retain their genuine titles", async ({ page }) => {
  expect(entries.some((entry) => entry.format === "feature")).toBe(true);
  expect(entries.some((entry) => entry.format === "short")).toBe(true);
  await page.goto("/?collection=archival");
  for (const [name, expected] of [
    ["features", entries.filter((entry) => entry.format === "feature").map(movieId)],
    ["shorts", entries.filter((entry) => entry.format === "short").map(movieId)],
    ["recently-added", [...archiveIds].reverse()],
  ]) {
    await collection(page, name);
    expect(await displayedIds(page)).toEqual(expected);
  }
  await collection(page, "archival");
  const genre = entries[0].genres[0];
  await page.getByRole("combobox", { name: "Genre", exact: true }).selectOption(genre);
  expect(await displayedIds(page)).toEqual(entries.filter((entry) => entry.genres.includes(genre)).map(movieId));
  const selected = entries.find((entry) => entry.format === "feature");
  await page.goto(`/search?type=film&q=${encodeURIComponent(selected.title)}`);
  await page.getByRole("button", { name: "Show results", exact: true }).click();
  expect(await displayedIds(page)).toContain(movieId(selected));
  const searched = await displayedIds(page);
  expect(searched.every((id) => id.startsWith("film-"))).toBe(true);
  expect(searched.every((id) => archiveIds.includes(id))).toBe(true);
  await page.goto("/search?type=film&q=zz-no-such-film");
  await page.getByRole("button", { name: "Show results", exact: true }).click();
  await expect(page.locator(".experience-choice")).toHaveCount(0);
});

test("desktop and phone keep a bounded cinematic poster wall, lazy artwork and honest missing-poster fallback", async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Image failures replace img nodes with title cards. Capture the real
  // loading attributes at insertion, before intercepted failures settle.
  await page.addInitScript(() => {
    window.__archivalPosterLoads = [];
    const seen = new WeakSet();
    new MutationObserver(() => {
      for (const image of document.querySelectorAll('.poster-tile[data-content-id^="film-archive-"] .choice-art img')) {
        if (seen.has(image)) continue;
        seen.add(image);
        window.__archivalPosterLoads.push({
          id: image.closest(".poster-tile").dataset.contentId,
          loading: image.getAttribute("loading"),
        });
      }
    }).observe(document, { childList: true, subtree: true });
  });
  const pictured = entries.find((entry) => entry.artwork);
  if (pictured) {
    const pathname = new URL(pictured.artwork, "http://127.0.0.1:3000").pathname;
    await page.route((url) => url.pathname === pathname, (route) => route.abort("blockedbyclient"));
  }
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?collection=archival");
    await expect(page.locator(".experience-choice")).toHaveCount(entries.length);
    const openMenu = page.getByRole("button", { name: "Open menu", exact: true });
    const mobileMenu = await openMenu.isVisible();
    if (mobileMenu) await openMenu.click();
    await expect(nav(page, "Movies")).toBeVisible();
    await expect(nav(page, "TV")).toBeVisible();
    await expect(nav(page, "Globe")).toBeVisible();
    if (mobileMenu) await page.getByRole("button", { name: "Close menu", exact: true }).click();
    if (entries.some((entry) => entry.artwork)) {
      expect(await page.evaluate(() => window.__archivalPosterLoads
        .filter((image) => image.loading === "lazy").length)).toBeGreaterThan(0);
    }
    const fallbackEntry = pictured || entries[0];
    await tile(page, fallbackEntry).scrollIntoViewIfNeeded();
    await expect(tile(page, fallbackEntry).locator(".title-poster-title")).toHaveText(fallbackEntry.title);
    await expect(tile(page, fallbackEntry).locator(".title-poster-year")).toHaveText(String(fallbackEntry.year));
    const box = await tile(page, fallbackEntry).boundingBox();
    expect(box.width).toBeGreaterThan(70);
    expect(box.height).toBeGreaterThan(100);
    await horizontalBounds(page);
    await page.screenshot({ path: `test-results/archival-movies/library-${width}x${height}.png` });
  }
  expect(errors).toEqual([]);
});

test("movie details retain feature versus short metadata and failed media stays inside Krispy", async ({ page, context }) => {
  const popups = [];
  context.on("page", (popup) => popups.push(popup));
  for (const format of ["feature", "short"]) {
    const entry = entries.find((item) => item.format === format);
    await page.goto(`/movie/${movieId(entry)}?watch=1`);
    const player = page.getByRole("region", { name: `${entry.title} player`, exact: true });
    await expect(player.locator("video")).toHaveAttribute("aria-label", `${entry.title} video`);
    await expect(player.locator("iframe")).toHaveCount(0);
    const details = page.getByRole("region", { name: "Title details", exact: true });
    await expect(details.getByRole("heading", { name: entry.title, exact: true })).toBeVisible();
    await expect(details.locator("dt", { hasText: /^Film type$/ })).toHaveCount(1);
    await expect(details.locator("dd", { hasText: format === "feature" ? /^Feature film$/ : /^Short film$/ })).toHaveCount(1);
    await expect(details.locator("dd", { hasText: new RegExp(`^${entry.year}$`) })).toHaveCount(1);
    await expect(details.getByRole("link", { name: "Source and licence", exact: true })).toHaveAttribute("href", entry.source.permissionUrl);
    await action(page, "Play");
    await expect(player.locator(".player-stage")).toHaveAttribute("data-state", "error");
    await expect(page.getByRole("link", { name: /Watch on Official Website|Watch externally/i })).toHaveCount(0);
    await expect(page.locator(".official-watch-card, .premium-panel")).toHaveCount(0);
    const previousVideo = await player.locator("video").elementHandle();
    await nav(page, "TV").click();
    await expect(page.locator(".stream-player, .experience-player-overlay")).toHaveCount(0);
    await expect.poll(() => previousVideo.evaluate((video) => ({ connected: video.isConnected,
      paused: video.paused, hasSource: video.hasAttribute("src") }))).toEqual({ connected: false, paused: true, hasSource: false });
    expect(await displayedIds(page)).toEqual(publicTVIds);
    await nav(page, "Globe").click();
    expect(await displayedIds(page)).toEqual(["destination-alveus-sanctuary", "destination-abisko"]);
    await nav(page, "Movies").click();
    expect(await displayedIds(page)).toContain(movieId(entry));
  }
  expect(popups).toEqual([]);
});

test("signed-in archival favorites and resume records survive reload and logout beside open films", async ({ page }) => {
  const api = await interceptFirebase(page);
  const entry = entries.find(item => item.format === "feature"), id = movieId(entry);
  const libraryKey = accountLibraryKey('firebase:' + VIEWERS[0].uid);
  const progress = { currentTime: 120, duration: entry.durationSeconds, updatedAt: Date.now() };
  await page.goto("/movies?collection=archival");
  await login(page, VIEWERS[0]);
  await page.evaluate(({ libraryKey, id, progress }) => {
    localStorage.setItem(libraryKey, JSON.stringify({ version: 1, saved: ["film-sintel"],
      recent: [id], progress: { [id]: progress } }));
  }, { libraryKey, id, progress });
  await page.reload();
  await action(page, 'Add ' + entry.title + ' to My list');
  await choose(page, "My list");
  expect(await displayedIds(page)).toEqual(["film-sintel", id]);
  await page.reload();
  expect(await displayedIds(page)).toEqual(["film-sintel", id]);
  await collection(page, "resume");
  expect(await displayedIds(page)).toEqual([id]);
  await expect(page.getByRole("button", { name: 'Resume ' + entry.title, exact: true })).toHaveCount(1);
  const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), libraryKey);
  expect(persisted.saved).toEqual(["film-sintel", id]);
  expect(persisted.progress[id]).toEqual(progress);
  await choose(page, "Log out");
  await choose(page, "My list");
  await expect(page.getByText("Log in or sign up to save your favorites.", { exact: true })).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), libraryKey)).toEqual(persisted);
  expect(api.unexpected).toEqual([]);
  expect(api.errors).toEqual([]);
});
