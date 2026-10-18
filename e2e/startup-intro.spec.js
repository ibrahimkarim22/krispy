const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/*", route => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

test("normal opening stays visible at 2.8 seconds and reveals the mounted site around 3.3 seconds", async ({ page }) => {
  await page.addInitScript(() => {
    const audit = window.__startupAudit = { mounted: null, removed: null, visibleAt2800: false };
    const observer = new MutationObserver(() => {
      const intro = document.querySelector(".startup-intro");
      if (intro && audit.mounted === null) {
        audit.mounted = performance.now();
        setTimeout(() => {
          audit.visibleAt2800 = intro.isConnected && Number(getComputedStyle(intro).opacity) > 0.05;
        }, 2800);
      } else if (!intro && audit.mounted !== null && audit.removed === null) {
        audit.removed = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/movies", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status", { name: "Opening Krispy", exact: true })).toBeVisible();
  await expect(page.locator(".startup-site")).toHaveAttribute("inert", "");
  await page.waitForFunction(() => window.__startupAudit?.removed !== null);
  const audit = await page.evaluate(() => window.__startupAudit);
  expect(audit.visibleAt2800).toBe(true);
  expect(audit.removed - audit.mounted).toBeGreaterThanOrEqual(3250);
  expect(audit.removed - audit.mounted).toBeLessThan(3800);
  await expect(page.getByRole("navigation", { name: "Krispy menu" })).toBeVisible();
  await expect(page.locator(".startup-site")).not.toHaveAttribute("inert", "");
});

test("two broad i-dot flashes accompany an unclipped Bowlby One wordmark on desktop and phone", async ({ page }) => {
  // Freeze the JS deadline, then sample the real CSS animations directly.
  // The real-clock test above separately verifies the production reveal.
  const epoch = new Date("2026-10-15T12:00:00Z");
  await page.clock.install({ time: epoch });
  await page.clock.pauseAt(new Date(epoch.getTime() + 1000));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 740], [1024, 400]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    const intro = page.getByRole("status", { name: "Opening Krispy", exact: true });
    await expect(intro).toBeVisible();
    const setTimeline = async time => intro.evaluate((element, sample) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = sample;
      }
    }, time);
    await setTimeline(0);
    await page.evaluate(() => document.fonts.ready);
    const wordmark = intro.locator(".startup-wordmark");
    await expect(wordmark).toHaveCSS("font-family", /"Bowlby One"(?:,|$)/);
    await expect(wordmark).toHaveCSS("font-weight", "400");
    expect(await wordmark.evaluate(element => document.fonts.check(getComputedStyle(element).font, "krispy"))).toBe(true);
    await expect(wordmark).toHaveCSS("color", "rgb(255, 255, 255)");
    const brandFamily = await wordmark.evaluate(element => getComputedStyle(element).fontFamily);
    const siteWordmarks = page.locator(".side-menu .wordmark, .collection-wordmark");
    await expect(siteWordmarks).toHaveCount(2);
    for (const brand of await siteWordmarks.all()) {
      await expect(brand).toHaveCSS("font-family", brandFamily);
      await expect(brand).toHaveCSS("font-weight", "400");
    }
    const navigationBrand = page.locator(".side-menu .wordmark");
    const brandBox = await navigationBrand.boundingBox();
    const buttonBox = await navigationBrand.locator("..").boundingBox();
    expect(brandBox.x).toBeGreaterThanOrEqual(buttonBox.x);
    expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(buttonBox.x + buttonBox.width);
    expect(brandBox.y).toBeGreaterThanOrEqual(buttonBox.y);
    expect(brandBox.y + brandBox.height).toBeLessThanOrEqual(buttonBox.y + buttonBox.height);
    const flashes = intro.locator(".startup-flash");
    await expect(flashes).toHaveCount(2);
    await expect(intro.locator(".startup-flash--camera")).toHaveCount(2);
    await expect(intro.locator(".startup-flash--screen")).toHaveCount(0);
    expect(await flashes.evaluateAll(nodes => nodes.every(node => {
      const background = getComputedStyle(node).backgroundImage;
      return !background.includes("ellipse") && (background.match(/radial-gradient\(/g) || []).length === 1;
    }))).toBe(true);
    const origin = intro.locator(".startup-dot-origin");
    await expect(origin.locator(".startup-flash")).toHaveCount(2);
    expect(await flashes.evaluateAll(nodes => nodes.every(node => Boolean(node.closest('[aria-hidden="true"]'))))).toBe(true);
    const layers = await origin.evaluate(element => ({
      glow: Number(getComputedStyle(element).zIndex),
      wordmark: Number(getComputedStyle(element.parentElement.querySelector(".startup-wordmark")).zIndex),
    }));
    expect(layers.glow).toBeLessThan(layers.wordmark);
    const animations = await intro.evaluate(element => element.getAnimations({ subtree: true }).map(animation => ({
      name: animation.animationName,
      iterations: animation.effect.getTiming().iterations,
    })));
    expect(animations.length).toBeGreaterThan(0);
    expect(animations.every(animation => animation.iterations === 1)).toBe(true);
    const parts = wordmark.locator(".wordmark-part");
    await expect(parts).toHaveCount(3);
    // Keep the transformed glyph out of the parent's text mask, which
    // otherwise paints a duplicate i before the k in Chromium.
    expect(await wordmark.evaluate(element => getComputedStyle(element).backgroundClip.includes("text"))).toBe(false);
    expect(await parts.evaluateAll(nodes => nodes.every(element =>
      element.children.length === 0 && getComputedStyle(element).backgroundClip.includes("text")))).toBe(true);
    const backgroundOffsets = async () => parts.evaluateAll(nodes => nodes.map(element =>
      parseFloat(getComputedStyle(element).backgroundPositionX.split(",")[0])));
    for (const [sample, filename] of [[200, "blur"], [1800, "soft"]]) {
      await setTimeline(sample);
      const filter = await wordmark.evaluate(element => getComputedStyle(element).filter);
      const blur = Number(filter.match(/(?:^|\s)blur\(([\d.]+)px\)/)?.[1]);
      expect(filter).toContain("drop-shadow(");
      if (filename === "blur") expect(blur).toBeGreaterThan(5);
      else {
        expect(blur).toBeGreaterThan(0);
        expect(blur).toBeLessThan(2);
      }
      await page.screenshot({ path: `test-results/startup-intro/${filename}-${width}x${height}.png` });
    }
    await setTimeline(500);
    const earlier = await backgroundOffsets();
    await setTimeline(2000);
    const later = await backgroundOffsets();
    for (let index = 0; index < later.length; index += 1) {
      expect(later[index]).toBeGreaterThan(earlier[index]);
      expect(later[index] - earlier[index]).toBeCloseTo(later[0] - earlier[0], 1);
    }
    const anchor = await origin.evaluate(element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    expect(anchor.width).toBe(0);
    expect(anchor.height).toBe(0);
    const logo = await wordmark.boundingBox();
    const fontSize = await wordmark.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    const letters = await page.locator(".startup-wordmark, .side-menu .wordmark, .collection-wordmark").evaluateAll(nodes => nodes.map(element => {
      const glyph = element.querySelector(".wordmark-i");
      if (!glyph) return { missing: true };
      const style = getComputedStyle(glyph);
      const matrix = new DOMMatrix(style.transform);
      const rect = glyph.getBoundingClientRect();
      const size = parseFloat(style.fontSize);
      const origin = style.transformOrigin.split(" ").map(parseFloat);
      const baseline = rect.top + matrix.d * origin[1];
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText("i");
      const surface = element.matches(".startup-wordmark") ? element
        : element.closest(".side-menu, .collection-footer");
      const clip = surface.getBoundingClientRect();
      return {
        intro: element.matches(".startup-wordmark"),
        scaleX: matrix.a,
        scaleY: matrix.d,
        painted: style.webkitTextFillColor === "rgb(255, 255, 255)" ||
          (style.backgroundClip.includes("text") && style.backgroundImage.includes("linear-gradient")),
        ink: {
          left: rect.left - metrics.actualBoundingBoxLeft,
          right: rect.left + metrics.actualBoundingBoxRight,
          top: baseline - matrix.d * metrics.actualBoundingBoxAscent,
          bottom: baseline + matrix.d * metrics.actualBoundingBoxDescent,
        },
        clip: { left: clip.left, right: clip.right, top: clip.top, bottom: clip.bottom },
        dot: {
          x: rect.left + size * 371.5 / 2048,
          y: baseline - matrix.d * size * 1441 / 2048,
        },
      };
    }));
    expect(letters).toHaveLength(3);
    for (const letter of letters) {
      expect(letter.missing).not.toBe(true);
      expect(letter.scaleX).toBe(1);
      expect(letter.scaleY).toBeCloseTo(1.3, 3);
      expect(letter.painted).toBe(true);
      expect(letter.ink.left).toBeGreaterThanOrEqual(letter.clip.left);
      expect(letter.ink.right).toBeLessThanOrEqual(letter.clip.right);
      expect(letter.ink.top).toBeGreaterThanOrEqual(letter.clip.top);
      expect(letter.ink.bottom).toBeLessThanOrEqual(letter.clip.bottom);
    }
    const ink = await wordmark.evaluate(element => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText(element.textContent);
      const lineHeight = parseFloat(style.lineHeight);
      const baseline = parseFloat(style.paddingTop) +
        (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
      return {
        left: parseFloat(style.paddingLeft) - metrics.actualBoundingBoxLeft,
        right: parseFloat(style.paddingLeft) + metrics.actualBoundingBoxRight,
        top: baseline - metrics.actualBoundingBoxAscent,
        bottom: baseline + metrics.actualBoundingBoxDescent,
      };
    });
    // The text background clips to the span, so all glyph ink, including
    // the p/y descenders and italic overhang, must fit inside that box.
    expect(ink.left).toBeGreaterThan(1);
    expect(ink.top).toBeGreaterThan(1);
    expect(ink.right).toBeLessThan(logo.width - 1);
    expect(ink.bottom).toBeLessThan(logo.height - 1);
    expect(logo.x).toBeGreaterThanOrEqual(0);
    expect(logo.y).toBeGreaterThanOrEqual(0);
    expect(logo.x + logo.width).toBeLessThanOrEqual(width);
    expect(logo.y + logo.height).toBeLessThanOrEqual(height);
    // The i is stretched around its baseline, so its dot moves upward
    // by (scale - 1) times the dot's original height above that baseline.
    expect(anchor.x - logo.x).toBeCloseTo(fontSize * 1.717373, 1);
    expect(anchor.y - logo.y).toBeCloseTo(fontSize * (0.394512 - 0.3 * 1441 / 2048), 1);
    const introLetter = letters.find(letter => letter.intro);
    expect(anchor.x).toBeCloseTo(introLetter.dot.x, 0);
    expect(anchor.y).toBeCloseTo(introLetter.dot.y, 0);
    for (const [sample, index, filename] of [[542, 0, "flash-first"], [842, 1, "flash-second"]]) {
      await setTimeline(sample);
      const flash = flashes.nth(index);
      const bloom = await flash.boundingBox();
      expect(bloom.width).toBeGreaterThan(fontSize * 11.2);
      expect(bloom.width).toBeLessThan(fontSize * 12.8);
      expect(bloom.height).toBeCloseTo(bloom.width, 1);
      expect(bloom.width).toBeGreaterThan(logo.width * 2);
      expect(bloom.x + bloom.width / 2).toBeCloseTo(anchor.x, 1);
      expect(bloom.y + bloom.height / 2).toBeCloseTo(anchor.y, 1);
      const opacity = await flash.evaluate(element => Number(getComputedStyle(element).opacity));
      expect(opacity).toBeGreaterThan(0.05);
      expect(opacity).toBeLessThanOrEqual(0.65);
      expect(await flashes.nth(1 - index).evaluate(element => Number(getComputedStyle(element).opacity))).toBe(0);
      await page.screenshot({ path: `test-results/startup-intro/${filename}-${width}x${height}.png` });
    }
    for (const sample of [2190, 2700]) {
      await setTimeline(sample);
      expect(await flashes.evaluateAll(nodes => nodes.every(element => Number(getComputedStyle(element).opacity) === 0))).toBe(true);
    }
    await expect(intro).toHaveCSS("opacity", "1");
    await expect(intro).toHaveCSS("background-color", "rgb(0, 0, 0)");
    expect(animations.some(animation => /screen-flash/.test(animation.name))).toBe(false);
    await page.screenshot({ path: `test-results/startup-intro/settled-${width}x${height}.png` });
    await setTimeline(3100);
    const fading = await intro.evaluate(element => Number(getComputedStyle(element).opacity));
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    await page.keyboard.press("Escape");
    await expect(intro).toHaveCount(0);
    await expect(page.locator(".side-menu")).toBeVisible();
    await page.screenshot({ path: `test-results/startup-intro/navigation-${width}x${height}.png` });
  }
});

test("click and Escape skip the opening and immediately enable the site", async ({ page }) => {
  for (const method of ["click", "Escape"]) {
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    const intro = page.getByRole("status", { name: "Opening Krispy", exact: true });
    await expect(intro).toBeVisible();
    if (method === "click") await intro.click({ position: { x: 20, y: 20 } });
    else await page.keyboard.press("Escape");
    await expect(intro).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Krispy menu" })).toBeVisible();
    await expect(page.locator(".startup-site")).not.toHaveAttribute("inert", "");
  }
});

test("reduced motion opens directly without a splash or decorative flashes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/liveglobe", { waitUntil: "domcontentloaded" });
  const menu = page.getByRole("navigation", { name: "Krispy menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Krispy — Movies", exact: true }).click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(page.locator(".startup-intro, .startup-flash")).toHaveCount(0);
  await expect(page.locator(".startup-site")).toHaveClass(/is-revealed/);
});

test("sidebar and footer brand actions replay the intro and return to Movies without remounting the app", async ({ page }) => {
  await page.goto("/livetv/channel-live-UNWebTV.us-SD", { waitUntil: "domcontentloaded" });
  const intro = page.getByRole("status", { name: "Opening Krispy", exact: true });
  await expect(intro).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "UN Web TV player", exact: true })).toBeVisible();
  const app = await page.locator(".experience").elementHandle();
  const menu = page.getByRole("navigation", { name: "Krispy menu" });
  const sidebarBrand = menu.getByRole("button", { name: "Krispy — Movies", exact: true });
  await sidebarBrand.click();
  await expect(page).toHaveURL(/\/movies$/);
  await expect(intro).toBeVisible();
  await expect(page.locator(".experience-player-overlay")).toHaveCount(0);
  expect(await app.evaluate(element => element.isConnected)).toBe(true);
  await expect(intro).toHaveCount(0);
  await expect(sidebarBrand).toBeFocused();
  const footer = page.getByRole("contentinfo", { name: "End of collection", exact: true });
  const brand = footer.getByRole("button", { name: "Krispy — Movies", exact: true });
  await brand.scrollIntoViewIfNeeded();
  await brand.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/movies$/);
  await expect(intro).toBeVisible();
  expect(await app.evaluate(element => element.isConnected)).toBe(true);
  await expect(intro).toHaveCount(0);
  await expect(menu).toBeVisible();
  await expect(sidebarBrand).toBeFocused();
  await expect.poll(() => page.locator(".poster-wall").evaluate(element => element.scrollTop)).toBe(0);
  await expect(page.locator(".experience-player-overlay")).toHaveCount(0);
  expect(await app.evaluate(element => element.isConnected)).toBe(true);
  await app.dispose();
});
