const { test, expect } = require("@playwright/test");

let pageErrors;
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});
test.afterEach(() => expect(pageErrors).toEqual([]));

const navigation = page => page.getByRole("navigation", { name: "Krispy menu", exact: true });
async function visit(page, path) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(navigation(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function choose(page, name) {
  const nav = navigation(page);
  const toggle = nav.getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole("button", { name, exact: true }).click();
}
async function belowHeader(page, locator) {
  const header = await navigation(page).boundingBox();
  const surface = await locator.boundingBox();
  expect(surface.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(surface.x).toBeGreaterThanOrEqual(-0.5);
  expect(surface.x + surface.width).toBeLessThanOrEqual((await page.viewportSize()).width + 0.5);
}
async function noPageOverflow(page) {
  const bounds = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    x: scrollX,
    y: scrollY,
  }));
  expect(bounds.width).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.x).toBe(0);
  expect(bounds.y).toBe(0);
}
async function enlargedFeature(page, previousHeight) {
  await expect(page.getByRole("heading", { name: "Browse movies", exact: true })).toHaveCount(0);
  const featured = page.getByRole("region", { name: "Featured movie", exact: true });
  const box = await featured.boundingBox();
  expect(box.height).toBeGreaterThan(previousHeight);
  for (const action of await featured.locator(".featured-movie-actions button").all()) {
    await expect(action).toBeEnabled();
    const control = await action.boundingBox();
    expect(control.x).toBeGreaterThanOrEqual(box.x);
    expect(control.x + control.width).toBeLessThanOrEqual(box.x + box.width);
    expect(control.y + control.height).toBeLessThanOrEqual(box.y + box.height);
  }
}
async function inlineFilters(page, labels) {
  const filters = page.getByRole("group", { name: "Filters", exact: true });
  await expect(filters).toBeVisible();
  await expect(filters.getByRole("combobox")).toHaveCount(labels.length);
  await expect(page.getByRole("button", { name: "Filters", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Browse filters", exact: true })).toHaveCount(0);
  await expect(navigation(page).getByRole("combobox")).toHaveCount(0);
  await belowHeader(page, filters);
  const group = await filters.boundingBox();
  for (const label of labels) {
    const control = filters.getByRole("combobox", { name: label, exact: true });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(group.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(group.x + group.width + 0.5);
  }
  expect(await filters.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  return filters;
}
async function changeInlineFilter(page, filters, label, value) {
  const control = filters.getByRole("combobox", { name: label, exact: true });
  await control.scrollIntoViewIfNeeded();
  await control.focus();
  await control.selectOption(value);
  await expect(control).toBeFocused();
  await expect(control).toBeInViewport({ ratio: 1 });
  await belowHeader(page, control);
}
async function changeMovieFilters(page) {
  const filters = await inlineFilters(page, ["Collection", "Genre", "Sort"]);
  await changeInlineFilter(page, filters, "Collection", "open");
  await expect(page).toHaveURL(/collection=open/);
  await expect(page.getByRole("status", { name: "Results", exact: true })).toHaveText("5");
  await changeInlineFilter(page, filters, "Sort", "title");
  await expect(page).toHaveURL(/sort=title/);
  await changeInlineFilter(page, filters, "Collection", "all");
  await expect(page.getByRole("region", { name: "Featured movie", exact: true })).toBeVisible();
  await changeInlineFilter(page, filters, "Genre", "Animation");
  await expect(page).toHaveURL(/genre=Animation/);
  await expect(page.getByRole("region", { name: "Featured movie", exact: true })).toHaveCount(0);
  await changeInlineFilter(page, filters, "Genre", "All");
  await expect(page.getByRole("region", { name: "Featured movie", exact: true })).toBeVisible();
}

test("desktop header stays in one row and preserves tab URLs and history", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1024, 768], [1280, 400]]) {
    await page.setViewportSize({ width, height });
    await visit(page, "/movies");
    const nav = navigation(page);
    const bar = await nav.boundingBox();
    expect(bar.x).toBe(0);
    expect(bar.y).toBe(0);
    expect(bar.width).toBe(width);
    expect(bar.height).toBe(80);
    const labels = ["Krispy — Movies", "Movies", "TV", "Globe", "Search", "My list", "Login", "Sign up"];
    let previous;
    for (const label of labels) {
      const control = nav.getByRole("button", { name: label, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(bar.y);
      expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height);
      if (previous) expect(box.x).toBeGreaterThanOrEqual(previous.x + previous.width - 0.5);
      previous = box;
    }
    expect((await nav.getByRole("button", { name: "Search", exact: true }).boundingBox()).x).toBeGreaterThan(width / 2);
    await expect(nav.getByRole("button", { name: "Filters", exact: true })).toHaveCount(0);
    await expect(nav.locator(".wordmark")).toHaveCSS("font-family", /"Bowlby One"(?:,|$)/);
    await belowHeader(page, page.locator(".poster-wall"));
    await enlargedFeature(page, Math.min(500, Math.max(380, height * 0.48)));
    await inlineFilters(page, ["Collection", "Genre", "Sort"]);
    await page.screenshot({ path: `test-results/horizontal-header/movies-${width}x${height}.png` });
    if (height < 500) {
      await changeMovieFilters(page);
      await page.screenshot({ path: `test-results/horizontal-header/inline-filters-${width}x${height}.png` });
    }
    await choose(page, "TV");
    await expect(page).toHaveURL(/\/livetv$/);
    await expect(page.getByRole("heading", { name: "Live TV", exact: true })).toBeVisible();
    await choose(page, "Globe");
    await expect(page).toHaveURL(/\/liveglobe$/);
    await expect(page.getByRole("heading", { name: "Globe", exact: true })).toBeVisible();
    await page.goBack();
    await expect(nav.getByRole("button", { name: "TV", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goForward();
    await expect(nav.getByRole("button", { name: "Globe", exact: true })).toHaveAttribute("aria-pressed", "true");
    await noPageOverflow(page);
  }
});

test("inline filters, Search, guest My list and Login retain state and focus", async ({ page }) => {
  await visit(page, "/movies");
  await changeMovieFilters(page);

  await choose(page, "Search");
  await expect(page).toHaveURL(/\/search$/);
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await belowHeader(page, search);
  await search.getByRole("searchbox", { name: "Search everything", exact: true }).fill("Sintel");
  await search.getByRole("button", { name: "Show results", exact: true }).click();
  await expect(navigation(page).getByRole("button", { name: "Search", exact: true })).toBeFocused();
  await expect(page).toHaveURL(/q=Sintel/);
  await expect(page.getByRole("button", { name: "Select Sintel", exact: true })).toBeVisible();
  await choose(page, "My list");
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(page.getByText("Log in or sign up to save your favorites.", { exact: true })).toBeVisible();
  const login = navigation(page).getByRole("button", { name: "Login", exact: true });
  await login.click();
  const account = page.getByRole("dialog", { name: "Login", exact: true });
  await expect(account).toBeVisible();
  await belowHeader(page, account);
  await account.getByRole("button", { name: "Close account", exact: true }).click();
  await expect(login).toBeFocused();
  await expect(page).toHaveURL(/\/favorites$/);
  const info = navigation(page).getByRole("button", { name: "Info", exact: true });
  await info.click();
  const credits = page.getByRole("dialog", { name: "Credits", exact: true });
  await expect(credits.getByRole("heading", { name: "Current collection", exact: true })).toBeVisible();
  await credits.getByRole("button", { name: "Close information", exact: true }).click();
  await expect(info).toBeFocused();
  await noPageOverflow(page);
});

test("sparse TV and Globe anchor their footer while Movies scroll beneath the fixed header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ["/livetv", "/liveglobe"]) {
    await visit(page, path);
    await inlineFilters(page, path === "/livetv" ? ["Country", "Language", "Genre", "Sort"] : ["Genre", "Sort"]);
    const footer = page.getByRole("contentinfo", { name: "End of collection", exact: true });
    await expect(footer).toBeInViewport();
    const box = await footer.boundingBox();
    expect(box.y + box.height).toBeCloseTo(900, 0);
    await expect(page.locator(".poster-tile")).toHaveCount(2);
    await page.screenshot({ path: `test-results/horizontal-header/${path.slice(1)}-footer.png` });
    await noPageOverflow(page);
  }
  await visit(page, "/movies");
  const wall = page.locator(".poster-wall");
  expect(await wall.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(100);
  await wall.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const footer = page.getByRole("contentinfo", { name: "End of collection", exact: true });
  await expect(footer).toBeInViewport();
  expect((await navigation(page).boundingBox()).y).toBe(0);
  const about = footer.getByRole("button", { name: "About", exact: true });
  await about.click();
  const credits = page.getByRole("dialog", { name: "Credits", exact: true });
  await expect(credits.getByRole("heading", { name: "Current collection", exact: true })).toBeVisible();
  await belowHeader(page, credits);
  await credits.getByRole("button", { name: "Close information", exact: true }).click();
  await expect(about).toBeFocused();
  await noPageOverflow(page);
});

test("direct viewing and movie, TV and Globe previews stay below the header", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await visit(page, "/movie/film-sintel?watch=1");
    await expect(page.getByRole("region", { name: "Sintel player", exact: true })).toBeVisible();
    await belowHeader(page, page.locator(".experience-player-overlay"));
    await belowHeader(page, page.getByRole("button", { name: "Close playback", exact: true }));
    await page.screenshot({ path: `test-results/horizontal-header/watch-${width}x${height}.png` });
    await page.getByRole("button", { name: "Close playback", exact: true }).click();
    await expect(page).toHaveURL(/\/movies(?:\?.*)?$/);
    await noPageOverflow(page);
  }
  for (const [width, height, path, title] of [
    [1440, 900, "/movies", "Sintel"],
    [1440, 900, "/livetv", "TV from the Danish Parliament"],
    [1440, 900, "/liveglobe", "Alveus Sanctuary"],
    [1024, 400, "/movies", "Sintel"],
  ]) {
    await page.setViewportSize({ width, height });
    await visit(page, path);
    const card = page.getByRole("button", { name: `Select ${title}`, exact: true });
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    const preview = page.getByRole("region", { name: `${title} preview`, exact: true });
    await expect(preview).toBeVisible();
    await belowHeader(page, preview);
    const box = await preview.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
    await page.screenshot({ path: `test-results/horizontal-header/preview-${path.slice(1)}-${width}x${height}.png` });
  }
});

test("mobile header and drawer preserve keyboard trapping, routes and panel focus", async ({ page }) => {
  for (const [width, height] of [[390, 844], [320, 740], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await visit(page, "/movies");
    const nav = navigation(page);
    const box = await nav.boundingBox();
    expect(box.width).toBe(width);
    expect(box.y).toBe(0);
    expect(box.height).toBe(56);
    const toggle = nav.getByRole("button", { name: "Open menu", exact: true });
    await expect(toggle).toBeVisible();
    await belowHeader(page, page.locator(".poster-wall"));
    await enlargedFeature(page, width <= 600
      ? Math.min(400, Math.max(350, height * 0.52))
      : Math.min(500, Math.max(380, height * 0.48)));
    await page.screenshot({ path: `test-results/horizontal-header/movies-mobile-${width}x${height}.png` });
    await changeMovieFilters(page);
    await page.screenshot({ path: `test-results/horizontal-header/inline-filters-${width}x${height}.png` });
    await toggle.click();
    const drawer = nav.getByRole("dialog", { name: "Navigation", exact: true });
    await expect(drawer).toBeVisible();
    await expect(page.locator(".poster-wall")).toHaveAttribute("inert", "");
    const controls = drawer.locator('button:not(:disabled):not([tabindex="-1"])');
    await controls.last().focus();
    await page.keyboard.press("Tab");
    await expect(controls.first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(controls.last()).toBeFocused();
    await page.screenshot({ path: `test-results/horizontal-header/drawer-${width}x${height}.png` });
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(toggle).toBeFocused();
    await choose(page, "TV");
    await expect(page).toHaveURL(/\/livetv$/);
    await expect(toggle).toBeFocused();
    const filters = await inlineFilters(page, ["Country", "Language", "Genre", "Sort"]);
    await changeInlineFilter(page, filters, "Country", "Denmark");
    await expect(page).toHaveURL(/country=Denmark/);
    await expect(page.locator(".poster-tile")).toHaveCount(1);
    await choose(page, "Login");
    const login = page.getByRole("dialog", { name: "Login", exact: true });
    await expect(login).toBeVisible();
    await belowHeader(page, login);
    await login.getByRole("button", { name: "Close account", exact: true }).click();
    await expect(toggle).toBeFocused();
    await choose(page, "Globe");
    await expect(page).toHaveURL(/\/liveglobe$/);
    await expect(page.getByRole("heading", { name: "Globe", exact: true })).toBeVisible();
    await noPageOverflow(page);
  }
});
