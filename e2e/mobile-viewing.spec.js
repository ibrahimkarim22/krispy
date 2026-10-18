const { test, expect } = require("@playwright/test");

const watches = [
  { title: "Sintel", path: "/movie/film-sintel?collection=all&watch=1", next: "TV", nextPath: /\/livetv$/ },
  { title: "UN Web TV", path: "/livetv/channel-live-UNWebTV.us-SD", next: "Globe", nextPath: /\/liveglobe$/ },
  { title: "Abisko", path: "/liveglobe/destination-abisko", next: "Movies", nextPath: /\/movies$/ },
];
const navigation = page => page.getByRole("navigation", { name: "Krispy menu", exact: true });
const openMenu = page => page.getByRole("button", { name: "Open menu", exact: true });
const drawer = page => page.getByRole("dialog", { name: "Navigation", exact: true });
const playerFor = (page, title) => page.getByRole("region", { name: `${title} player`, exact: true });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // These tests exercise local layout and navigation without fetching streams.
  await page.route("**/*", route => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

async function showDrawer(page) {
  await openMenu(page).click();
  await expect(drawer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu", exact: true })).toBeFocused();
}

async function expectDefaultTheater(page, title) {
  const player = playerFor(page, title);
  await expect(player).toBeVisible();
  await expect(player).toHaveClass(/\btheater\b/);
  await expect(page.getByRole("button", { name: /^(?:Exit )?Theater view$/i })).toHaveCount(0);
  return player;
}

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overlay = page.locator(".experience-player-overlay");
  if (await overlay.count()) {
    expect(await overlay.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
}

async function expectMobileSurface(page, title, width, height) {
  await expect(openMenu(page)).toBeVisible();
  await expect(navigation(page).getByRole("button", { name: "Movies", exact: true })).toHaveCount(0);
  const toggle = await openMenu(page).boundingBox();
  expect(toggle.y).toBeGreaterThanOrEqual(0);
  expect(toggle.y + toggle.height).toBeLessThanOrEqual(56);
  const overlay = await page.locator(".experience-player-overlay").boundingBox();
  expect(overlay.x).toBe(0);
  expect(overlay.y).toBe(56);
  expect(overlay.width).toBe(width);
  expect(overlay.y + overlay.height).toBe(height);
  const player = await expectDefaultTheater(page, title);
  const bounds = await player.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(56);
  expect(bounds.width).toBeGreaterThanOrEqual(width - 32);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  await expectNoHorizontalOverflow(page);
}

test("desktop navigation remains above default theater Movies, TV, and Globe", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const { title, path } of watches) {
    await page.goto(path);
    await expect(navigation(page)).toBeVisible();
    await expect(openMenu(page)).toBeHidden();
    await expectDefaultTheater(page, title);
    const menuBounds = await navigation(page).boundingBox();
    const overlayBounds = await page.locator(".experience-player-overlay").boundingBox();
    expect(overlayBounds.y).toBeGreaterThanOrEqual(menuBounds.y + menuBounds.height);
    await expectNoHorizontalOverflow(page);
  }
  await navigation(page).getByRole("button", { name: "Movies", exact: true }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page.locator(".experience-player-overlay")).toHaveCount(0);
});

test("360 and 390 pixel phones give all watching views the space below the header", async ({ page }) => {
  for (const [width, height] of [[360, 800], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const { title, path } of watches) {
      await page.goto(path);
      await expectMobileSurface(page, title, width, height);
      // Twitch's official minimum width is retained on narrow Globe views.
      if (title === "Abisko") await expect(playerFor(page, title).getByText(/400 pixels.*width/i)).toBeVisible();
      if (width === 390) await page.screenshot({ path: `test-results/mobile-viewing/${title.replace(/\s/g, "-")}-phone.png` });
    }
  }
});

test("portrait Twitch players use the available width and keep recovery controls compact", async ({ page }) => {
  for (const width of [400, 414, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/liveglobe/destination-abisko");
    const player = playerFor(page, "Abisko");
    const iframe = player.locator("iframe");
    await expect(iframe).toBeVisible();
    const bounds = await iframe.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(400);
    expect(bounds.height).toBeGreaterThanOrEqual(300);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expect(player.getByText(/400 pixels/i)).toHaveCount(0);
    await expect(player.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    await expect(player.getByRole("button", { name: "Choose another", exact: true })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(watches[0].path);
  const movie = playerFor(page, "Sintel");
  await expect(movie.getByRole("button", { name: "Full screen", exact: true })).toHaveCount(0);
  await expect(movie.getByRole("button", { name: "Choose another", exact: true })).toHaveCount(0);
  await expect(movie.getByRole("button", { name: "Enter fullscreen", exact: true })).toBeVisible();
  await movie.locator("video").evaluate(video => video.dispatchEvent(new Event("error")));
  const retry = movie.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  const retryBounds = await retry.boundingBox();
  expect(retryBounds.height).toBe(44);
  expect(retryBounds.width).toBeLessThan(100);
  await expect(movie.getByRole("button", { name: "Close playback", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Close playback", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("the hamburger switches sections during each playing view and closes the player", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { title, path, next, nextPath } of watches) {
    await page.goto(path);
    const player = await expectDefaultTheater(page, title);
    const originalPlayer = await player.elementHandle();
    await showDrawer(page);
    // Opening navigation leaves the existing player mounted behind the drawer.
    expect(await originalPlayer.evaluate(element => element.isConnected)).toBe(true);
    await expect(page.locator(".experience-player-overlay")).toHaveCount(1);
    await navigation(page).getByRole("button", { name: next, exact: true }).click();
    await expect(page).toHaveURL(nextPath);
    await expect(drawer(page)).toBeHidden();
    await expect(page.locator(".experience-player-overlay")).toHaveCount(0);
    expect(await originalPlayer.evaluate(element => element.isConnected)).toBe(false);
    await expect(openMenu(page)).toBeFocused();
    await originalPlayer.dispose();
    await expectNoHorizontalOverflow(page);
  }
});

test("mobile navigation traps focus and restores it after Escape, backdrop, and Login", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/movies");
  await openMenu(page).focus();
  await page.keyboard.press("Enter");
  await expect(drawer(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu", exact: true })).toBeFocused();
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press(index % 3 === 0 ? "Shift+Tab" : "Tab");
    expect(await drawer(page).evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
  await expect(openMenu(page)).toBeFocused();
  await showDrawer(page);
  const backdrop = page.getByRole("button", { name: "Close navigation", exact: true });
  await expect(backdrop).toBeVisible();
  const backdropBounds = await backdrop.boundingBox();
  // Hit the exposed edge, outside the drawer's choices.
  await page.mouse.click(backdropBounds.x + backdropBounds.width - 4, backdropBounds.y + backdropBounds.height / 2);
  await expect(drawer(page)).toBeHidden();
  await expect(openMenu(page)).toBeFocused();

  await showDrawer(page);
  await navigation(page).getByRole("button", { name: "Login", exact: true }).click();
  const login = page.getByRole("dialog", { name: "Login", exact: true });
  await expect(login).toBeVisible();
  await expect(drawer(page)).toBeHidden();
  await expect(login.getByRole("textbox", { name: "Email", exact: true })).toBeFocused();
  await expectNoHorizontalOverflow(page);
  await login.getByRole("button", { name: "Close account", exact: true }).click();
  await expect(login).toBeHidden();
  await expect(openMenu(page)).toBeFocused();

  await showDrawer(page);
  await navigation(page).getByRole("button", { name: "Login", exact: true }).click();
  await expect(login).toBeVisible();
  await showDrawer(page);
  await navigation(page).getByRole("button", { name: "Globe", exact: true }).click();
  await expect(page).toHaveURL(/\/liveglobe$/);
  await expect(login).toBeHidden();
  await expect(drawer(page)).toBeHidden();
  await expect(openMenu(page)).toBeFocused();
});

test("portrait and landscape resizing keeps playback mounted and within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(watches[0].path);
  await expectMobileSurface(page, "Sintel", 390, 844);
  const originalVideo = await page.getByLabel("Sintel video", { exact: true }).elementHandle();
  for (const [width, height] of [[667, 375], [360, 800]]) {
    await page.setViewportSize({ width, height });
    await expectMobileSurface(page, "Sintel", width, height);
    expect(await originalVideo.evaluate(element => element.isConnected)).toBe(true);
    await showDrawer(page);
    const navBounds = await drawer(page).boundingBox();
    expect(navBounds.x).toBeGreaterThanOrEqual(0);
    expect(navBounds.y).toBeGreaterThanOrEqual(0);
    expect(navBounds.x + navBounds.width).toBeLessThanOrEqual(width);
    expect(navBounds.y + navBounds.height).toBeLessThanOrEqual(height);
    const lastChoice = navigation(page).getByRole("button", { name: "Sign up", exact: true });
    await lastChoice.scrollIntoViewIfNeeded();
    const lastBounds = await lastChoice.boundingBox();
    expect(lastBounds.y + lastBounds.height).toBeLessThanOrEqual(height);
    await page.keyboard.press("Escape");
    await expect(openMenu(page)).toBeFocused();
    await page.screenshot({ path: `test-results/mobile-viewing/movie-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(navigation(page)).toBeVisible();
  await expectMobileSurface(page, "Sintel", 844, 390);
  expect(await originalVideo.evaluate(element => element.isConnected)).toBe(true);
  await expectNoHorizontalOverflow(page);
  await originalVideo.dispose();
});
