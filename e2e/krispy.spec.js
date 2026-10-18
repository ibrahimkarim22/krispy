const { test, expect } = require("@playwright/test");
const { films, openFilms, classicFilms, channels, destinations } = require("../src/data/catalog");
const { sources } = require("../src/media/providers");
const { VIEWERS, interceptFirebase, login, choose } = require("./helpers/firebase");

// UI and SDK regressions use intercepted requests; they are not live-source playback evidence.
let pageErrors;
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});
test.afterEach(() => expect(pageErrors).toEqual([]));

const shownIds = page => page.locator(".experience-choice").evaluateAll(nodes => nodes.map(node => node.dataset.contentId));
async function action(page, label) {
  const button = page.getByRole("button", { name: label, exact: true }).first();
  await button.focus();
  await button.click();
}
async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await page.locator(".poster-wall").evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test('the supported movie wall contains 94 unique catalog titles at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/movies");
    await expect(page).toHaveTitle("Movies / Krispy");
    await expect(page.getByRole("region", { name: "Featured movie", exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: "Results", exact: true })).toHaveText("94");
    const ids = await shownIds(page);
    expect(ids).toHaveLength(94);
    expect(new Set(ids).size).toBe(94);
    expect([...ids].sort()).toEqual(films.map(item => item.id).sort());
    await expect(page.getByRole("button", { name: "Select Sintel", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Select The General", exact: true })).toHaveCount(1);
    for (const movie of classicFilms)
      await expect(page.locator(`.poster-tile[data-content-id="${movie.id}"]`).getByRole("button", { name: "Select " + movie.title, exact: true })).toHaveCount(1);
    await noHorizontalOverflow(page);
  });
}

test("Movies, TV and Globe have distinct URLs and restore exact supported collections through browser history", async ({ page }) => {
  await page.goto("/movies");
  await choose(page, "TV");
  await expect(page).toHaveURL(/\/livetv$/);
  expect(await shownIds(page)).toEqual(channels.map(item => item.id));
  await choose(page, "Globe");
  await expect(page).toHaveURL(/\/liveglobe$/);
  expect(await shownIds(page)).toEqual(destinations.map(item => item.id));
  await page.goBack();
  await expect(page).toHaveURL(/\/livetv$/);
  expect(await shownIds(page)).toEqual(channels.map(item => item.id));
  await page.goBack();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page).toHaveTitle("Movies / Krispy");
  expect(await shownIds(page)).toHaveLength(94);
});

test("inline movie filters and Search return the supported source collections", async ({ page }) => {
  await page.goto("/movies");
  const filters = page.getByRole("group", { name: "Filters", exact: true });
  await filters.getByRole("combobox", { name: "Collection", exact: true }).selectOption("open");
  expect(await shownIds(page)).toEqual(openFilms.map(item => item.id));
  await expect(page).toHaveURL(/collection=open/);
  await filters.getByRole("combobox", { name: "Collection", exact: true }).selectOption("chaplin");
  expect(await shownIds(page)).toEqual(classicFilms.map(item => item.id));
  await filters.getByRole("combobox", { name: "Collection", exact: true }).selectOption("archival");
  expect(await shownIds(page)).toHaveLength(41);
  await filters.getByRole("combobox", { name: "Genre", exact: true }).selectOption("Animation");
  expect(await shownIds(page)).toEqual(films.filter(item => item.isArchival && item.genres.includes("Animation")).map(item => item.id));
  await choose(page, "Search");
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("searchbox", { name: "Search everything", exact: true }).fill("Sintel");
  await search.getByRole("button", { name: "Show results", exact: true }).click();
  expect(await shownIds(page)).toEqual(["film-sintel"]);
  await expect(page).toHaveURL(/\/search\?.*q=Sintel/);
});

test("all five Blender viewing pages use their exact licensed files and retain controls and credits", async ({ page }) => {
  for (const item of openFilms) {
    await page.goto('/movie/' + item.id + '?watch=1');
    const player = page.getByRole("region", { name: item.title + " player", exact: true });
    const video = player.getByLabel(item.title + " video", { exact: true });
    await expect(video).toHaveAttribute("src", sources[item.sourceId].url);
    expect(await video.evaluate(element => element.muted)).toBe(true);
    await expect(player).toHaveClass(/theater/);
    await expect(player.getByRole("button", { name: "Enter fullscreen", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^(Full screen|Choose another|Theater view)$/ })).toHaveCount(0);
    const details = page.getByRole("region", { name: "Title details", exact: true });
    await expect(details.getByRole("heading", { name: item.title, exact: true })).toBeVisible();
    await expect(details.getByText(item.attribution, { exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: 'Add ' + item.title + ' to My list', exact: true })).toBeVisible();
    const mounted = await video.elementHandle();
    await page.getByRole("button", { name: "Close playback", exact: true }).click();
    expect(await mounted.evaluate(element => ({ connected: element.isConnected, paused: element.paused, src: element.getAttribute("src") })))
      .toEqual({ connected: false, paused: true, src: null });
    await mounted.dispose();
    await expect(page).toHaveURL(/\/movies(?:\?.*)?$/);
  }
});

test("movie information and Credits remain readable and close back to the initiating control", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies?collection=open");
    await action(page, "Info about Sintel");
    const info = page.getByRole("dialog", { name: "About Sintel", exact: true });
    await expect(info.getByRole("heading", { name: "Sintel", exact: true })).toBeVisible();
    await expect(info.getByRole("region", { name: "Description", exact: true }).locator("p")).toHaveText(films.find(item => item.id === "film-sintel").description);
    await info.getByRole("button", { name: "Close information", exact: true }).click();
    await expect(page.getByRole("button", { name: "Info about Sintel", exact: true }).first()).toBeFocused();
    await choose(page, "Info");
    const credits = page.getByRole("dialog", { name: "Credits", exact: true });
    await expect(credits.getByRole("heading", { name: "Current collection", exact: true })).toBeVisible();
    await expect(credits.getByRole("link", { name: "Danish Parliament license (opens in a new tab)", exact: true })).toHaveAttribute("href", /^https:/);
    await expect(credits.getByRole("link", { name: "Sintel license (opens in a new tab)", exact: true })).toHaveAttribute("href", "https://durian.blender.org/sharing/");
    await credits.getByRole("button", { name: "Close information", exact: true }).click();
    await expect(credits).toBeHidden();
    await noHorizontalOverflow(page);
  }
});

test("account favorites save supported Movies, TV and Globe across reload without leaking to another account", async ({ page }) => {
  const api = await interceptFirebase(page);
  await page.goto("/movies");
  await login(page, VIEWERS[0]);
  const selections = [films.find(item => item.id === "film-sintel"), channels[1], destinations[1]];
  for (const item of selections) {
    const prefix = { film: "/movie/", channel: "/livetv/", destination: "/liveglobe/" }[item.type];
    await page.goto(prefix + item.id + (item.type === "film" ? "?watch=1" : ""));
    await action(page, 'Add ' + item.title + ' to My list');
    await expect(page.getByRole("button", { name: 'Remove ' + item.title + ' from My list', exact: true })).toBeVisible();
  }
  await choose(page, "My list");
  expect(await shownIds(page)).toEqual(selections.map(item => item.id));
  await page.reload();
  expect(await shownIds(page)).toEqual(selections.map(item => item.id));
  await choose(page, "Log out");
  await login(page, VIEWERS[1]);
  await choose(page, "My list");
  expect(await shownIds(page)).toEqual([]);
  await choose(page, "Log out");
  await login(page, VIEWERS[0]);
  await choose(page, "My list");
  expect(await shownIds(page)).toEqual(selections.map(item => item.id));
  expect(api.unexpected).toEqual([]);
  expect(api.errors).toEqual([]);
});
