const { test, expect } = require("@playwright/test");

let pageErrors;
let focusRecords;
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  focusRecords = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  // These are layout checks: no accounts are submitted and no remote media loads.
  await page.route("**/*", route => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});
test.afterEach(async ({}, testInfo) => {
  await testInfo.attach("focus-ring-geometry", { body: JSON.stringify(focusRecords, null, 2), contentType: "application/json" });
  expect(pageErrors).toEqual([]);
});

const navigation = page => page.getByRole("navigation", { name: "Krispy menu", exact: true });
async function visit(page, path, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(navigation(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function choose(page, label) {
  const nav = navigation(page);
  const toggle = nav.getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await nav.getByRole("button", { name: label, exact: true }).click();
}

async function visibleFocusRing(page, control) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await page.keyboard.press("Tab");
  await control.focus();
  await expect(control).toBeFocused();
  const evidence = await control.evaluate(element => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const extent = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
    const ring = { left: bounds.left - extent, top: bounds.top - extent, right: bounds.right + extent, bottom: bounds.bottom + extent };
    const clips = [{ name: "viewport", x: true, y: true, left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const ancestorStyle = getComputedStyle(ancestor);
      const x = /^(auto|scroll|hidden|clip)$/.test(ancestorStyle.overflowX);
      const y = /^(auto|scroll|hidden|clip)$/.test(ancestorStyle.overflowY);
      if (!x && !y) continue;
      const rect = ancestor.getBoundingClientRect();
      const left = rect.left + ancestor.clientLeft;
      const top = rect.top + ancestor.clientTop;
      clips.push({ name: ancestor.className || ancestor.tagName, x, y, left, top,
        right: left + ancestor.clientWidth, bottom: top + ancestor.clientHeight });
    }
    const failures = clips.flatMap(clip => [
      ...(clip.x && ring.left < clip.left - 0.5 ? [`${clip.name}: left clipped by ${clip.left - ring.left}px`] : []),
      ...(clip.x && ring.right > clip.right + 0.5 ? [`${clip.name}: right clipped by ${ring.right - clip.right}px`] : []),
      ...(clip.y && ring.top < clip.top - 0.5 ? [`${clip.name}: top clipped by ${clip.top - ring.top}px`] : []),
      ...(clip.y && ring.bottom > clip.bottom + 0.5 ? [`${clip.name}: bottom clipped by ${ring.bottom - clip.bottom}px`] : []),
    ]);
    return { name: element.getAttribute("aria-label") || element.textContent.trim(),
      focusVisible: element.matches(":focus-visible"), outline: style.outline, offset: style.outlineOffset,
      outlineWidth: parseFloat(style.outlineWidth), ring, clips, failures };
  });
  focusRecords.push(evidence);
  expect(evidence.focusVisible, evidence.name).toBe(true);
  expect(evidence.outlineWidth, evidence.name).toBeGreaterThan(0);
  expect(evidence.failures, JSON.stringify(evidence, null, 2)).toEqual([]);
  return evidence;
}

for (const [width, height] of [[1440, 900], [320, 740]]) {
  test(`Sign up action focus rings fit the sheet at ${width}px`, async ({ page }, testInfo) => {
    await visit(page, "/movies", width, height);
    await choose(page, "Sign up");
    const dialog = page.getByRole("dialog", { name: "Sign up", exact: true });
    await dialog.getByLabel("Email", { exact: true }).fill("focus-layout@example.test");
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByLabel("Password", { exact: true }).fill("FocusLayout-123!");
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await dialog.getByLabel("Confirm password", { exact: true }).fill("FocusLayout-123!");
    for (const label of ["Back", "Use Login", "Close account", "Sign up"]) {
      await visibleFocusRing(page, dialog.getByRole("button", { name: label, exact: true }));
    }
    await page.screenshot({ path: testInfo.outputPath(`signup-${width}x${height}.png`) });
  });
}

test("Search controls retain complete focus rings on desktop and phone", async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 900], [320, 740], [844, 390]]) {
    await visit(page, "/movies", width, height);
    await choose(page, "Search");
    const dialog = page.getByRole("dialog", { name: "Search", exact: true });
    await dialog.getByRole("searchbox", { name: "Search everything", exact: true }).fill("Sintel");
    for (const label of ["Clear search", "Close filters", "Show results"]) {
      await visibleFocusRing(page, dialog.getByRole("button", { name: label, exact: true }));
    }
    await page.screenshot({ path: testInfo.outputPath(`search-${width}x${height}.png`) });
  }
});

test("Credits links and footer buttons have unclipped focus indicators", async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 900], [320, 740]]) {
    await visit(page, "/livetv", width, height);
    const footer = page.getByRole("contentinfo", { name: "End of collection", exact: true });
    for (const control of await footer.getByRole("button").all()) {
      if (await control.isEnabled()) await visibleFocusRing(page, control);
    }
    await footer.getByRole("button", { name: "About", exact: true }).click();
    const credits = page.getByRole("dialog", { name: "Credits", exact: true });
    await visibleFocusRing(page, credits.getByRole("button", { name: "Close information", exact: true }));
    await visibleFocusRing(page, credits.getByRole("link", { name: "Library of Congress (opens in a new tab)", exact: true }));
    await visibleFocusRing(page, credits.getByRole("link", { name: /^Danish Parliament license/ }));
    await page.screenshot({ path: testInfo.outputPath(`credits-${width}x${height}.png`) });
  }
});

test("Navigation, featured actions, previews and TV choices preserve focus rings", async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 900], [320, 740]]) {
    await visit(page, "/movies", width, height);
    await visibleFocusRing(page, navigation(page).locator(".side-menu-mark"));
    const menu = navigation(page).getByRole("button", { name: "Open menu", exact: true });
    if (await menu.isVisible()) {
      await visibleFocusRing(page, menu);
      await menu.click();
      await visibleFocusRing(page, navigation(page).getByRole("button", { name: "Movies", exact: true }));
      await navigation(page).getByRole("button", { name: "Close menu", exact: true }).click();
    } else {
      await visibleFocusRing(page, navigation(page).getByRole("button", { name: "Movies", exact: true }));
    }
    const featured = page.getByRole("region", { name: "Featured movie", exact: true });
    for (const control of await featured.getByRole("button").all()) await visibleFocusRing(page, control);

    await visit(page, "/livetv/channel-live-UNWebTV.us-SD", width, height);
    const rail = page.getByRole("complementary", { name: "TV channels", exact: true });
    for (const choice of await rail.getByRole("button").all()) await visibleFocusRing(page, choice);
    await visibleFocusRing(page, page.getByRole("button", { name: "Close playback", exact: true }));
    await page.screenshot({ path: testInfo.outputPath(`tv-choices-${width}x${height}.png`) });
  }

  await visit(page, "/movies", 1440, 900);
  const card = page.getByRole("button", { name: "Select Sintel", exact: true });
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  const preview = page.getByRole("region", { name: "Sintel preview", exact: true });
  const watch = await visibleFocusRing(page, preview.getByRole("button", { name: "Watch Sintel", exact: true }));
  expect(parseFloat(watch.offset)).toBeLessThan(0);
  await page.screenshot({ path: testInfo.outputPath("preview-watch.png") });
});
