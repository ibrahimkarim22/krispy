const { test, expect } = require("@playwright/test");

const choices = ["Movies", "TV", "Globe", "Search", "My list", "Info", "Login", "Sign up"];
const menu = page => page.getByRole("navigation", { name: "Krispy menu", exact: true });
const choice = (page, name) => menu(page).getByRole("button", { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

async function expectReachable(button, width, height, minimumTop = 0) {
  await expect(button).toBeVisible();
  const bounds = await button.boundingBox();
  expect(bounds.width).toBeGreaterThan(0);
  if (width < 1000) expect(bounds.width).toBeGreaterThanOrEqual(44);
  else if (bounds.width < 44) {
    // The current desktop header uses compact text buttons. A 44px region
    // around each target must remain clear of other navigation controls.
    const clearTarget = await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      return Array.from(element.closest("nav").querySelectorAll("button"))
        .filter(control => control !== element && !control.disabled)
        .every(control => {
          const other = control.getBoundingClientRect();
          if (!other.width || !other.height) return true;
          const x = Math.max(other.left - center.x, center.x - other.right, 0);
          const y = Math.max(other.top - center.y, center.y - other.bottom, 0);
          return Math.hypot(x, y) >= 22;
        });
    });
    expect(clearTarget).toBe(true);
  }
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(minimumTop);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
  expect(await button.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
}

test("desktop navigation keeps all eight actions reachable at wide, tablet, and short sizes", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [1200, 700], [1024, 440]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/livetv");
    await expect(choice(page, "TV")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeHidden();
    for (const name of choices) {
      await choice(page, name).scrollIntoViewIfNeeded();
      await expectReachable(choice(page, name), width, height);
    }
    const rail = await menu(page).boundingBox();
    const wall = await page.getByRole("region", { name: "Title chooser", exact: true }).boundingBox();
    expect(wall.y).toBeGreaterThanOrEqual(rail.y + rail.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await choice(page, "TV").scrollIntoViewIfNeeded();
    await choice(page, "TV").focus();
    await expect(choice(page, "TV")).toBeFocused();
    await page.screenshot({ path: `test-results/navigation-style/rail-${width}x${height}.png` });
  }
});

test("restyled destinations, utilities, and account actions retain routes and active selection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/movies");
  for (const [name, path] of [["TV", "/livetv"], ["Globe", "/liveglobe"], ["My list", "/favorites"], ["Movies", "/movies"]]) {
    await choice(page, name).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(choice(page, name)).toHaveAttribute("aria-pressed", "true");
    await expect(menu(page).getByRole("button", { pressed: true })).toHaveCount(1);
  }
  for (const [name, dialogName, closeName] of [
    ["Search", "Search", "Close filters"],
    ["Info", "Credits", "Close information"],
    ["Login", "Login", "Close account"],
    ["Sign up", "Sign up", "Close account"],
  ]) {
    await choice(page, name).click();
    const panel = page.getByRole("dialog", { name: dialogName, exact: true });
    await expect(panel).toBeVisible();
    await expect(choice(page, name)).toHaveAttribute("aria-pressed", "true");
    if (name === "Search") await expect(page).toHaveURL(/\/search$/);
    await panel.getByRole("button", { name: closeName, exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(choice(page, name)).toBeFocused();
  }
  const brand = menu(page).getByRole("button", { name: "Krispy \u2014 Movies", exact: true });
  await brand.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/movies$/);
  await expect(choice(page, "Movies")).toHaveAttribute("aria-pressed", "true");
  await expect(brand).toBeFocused();
  await page.screenshot({ path: "test-results/navigation-style/movies-1440x900.png" });
});

test("phone and landscape drawers keep the header and every action accessible", async ({ page }) => {
  for (const [width, height] of [[390, 844], [667, 375]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/livetv");
    const open = page.getByRole("button", { name: "Open menu", exact: true });
    await expectReachable(open, width, height);
    expect((await open.boundingBox()).y + (await open.boundingBox()).height).toBeLessThanOrEqual(56);
    await page.screenshot({ path: `test-results/navigation-style/header-${width}x${height}.png` });
    await open.click();
    const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu", exact: true })).toBeFocused();
    await expect(choice(page, "TV")).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `test-results/navigation-style/drawer-${width}x${height}.png` });
    for (const name of choices) {
      const action = choice(page, name);
      await action.scrollIntoViewIfNeeded();
      await expectReachable(action, width, height, 56);
    }
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(open).toBeFocused();
    const brand = menu(page).getByRole("button", { name: "Krispy \u2014 Movies", exact: true });
    await brand.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/movies$/);
    await expect(brand).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
