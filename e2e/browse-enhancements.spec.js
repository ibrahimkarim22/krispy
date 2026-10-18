const { test, expect } = require("@playwright/test");
const danishLicense = require("../src/data/liveTV.catalog.json").entries
  .find(entry => entry.channelId === "TVfromtheDanishParliament.dk").permission.fullLicenseText;
const nav = (page, name) => page.getByRole("navigation", { name: "Krispy menu" }).getByRole("button", { name, exact: true });
const chooseNavigation = async (page, name) => {
  const opener = page.getByRole("button", { name: "Open menu", exact: true });
  if (await opener.isVisible()) await opener.click();
  await nav(page, name).click();
};

async function recordedPreviewFixture(page) {
  // A short changing native fixture proves decoding without fetching a film.
  return Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    document.body.append(canvas);
    const drawing = canvas.getContext("2d");
    let frame = 0;
    const draw = () => {
      drawing.fillStyle = `hsl(${frame++ * 13}, 70%, 45%)`;
      drawing.fillRect(0, 0, 160, 90);
      drawing.fillStyle = "white";
      drawing.fillRect(frame % 140, 25, 20, 40);
    };
    draw();
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const finished = new Promise(resolve => { recorder.onstop = resolve; });
    const timer = setInterval(draw, 80);
    recorder.start();
    setTimeout(() => recorder.stop(), 8000);
    await finished;
    clearInterval(timer);
    stream.getTracks().forEach(track => track.stop());
    canvas.remove();
    return Array.from(new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer()));
  }));
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  // UI regressions do not fetch broadcaster video. Real preview playback is
  // checked separately against a small sample, never counted from this test.
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

test("public TV hides removed sources from direct links and search", async ({ page }) => {
  for (const id of ["channel-unknown", "channel-unavailable"]) {
    await page.goto(`/livetv/${id}?watch=1`);
    await expect(page.getByRole("heading", { name: "Live TV", exact: true, level: 1 })).toBeVisible();
    await expect(page.locator(".experience-choice")).toHaveCount(2);
    await expect(page.getByRole("complementary", { name: "TV channels" })).toHaveCount(0);
    await expect(page.locator("video, .stream-player iframe")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Unknown channel poster", exact: true })).toHaveCount(0);
  }
  await page.goto("/search?collection=channel&q=zz-unavailable-channel");
  await expect(page.getByRole("searchbox", { name: "Search everything" })).toHaveValue("zz-unavailable-channel");
  await expect(page.locator(".experience-choice")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /watch on official website/i })).toHaveCount(0);
});

test("landscape channels switch beside the player and history restores their URLs", async ({ page }) => {
  await page.goto("/liveglobe");
  await expect(page.getByRole("heading", { name: "Globe", exact: true, level: 1 })).toBeVisible();
  const globeCard = await page.locator(".poster-tile").first().boundingBox();
  await page.goto("/livetv");
  await expect(page.getByRole("heading", { name: "Live TV", exact: true, level: 1 })).toBeVisible();
  const expectedChannels = await page.locator(".experience-choice").count();
  expect(expectedChannels).toBe(2);
  const tile = page.getByRole("group", { name: "UN Web TV poster", exact: true });
  const bounds = await tile.boundingBox();
  expect(bounds.width).toBeGreaterThan(bounds.height);
  expect(Math.abs(bounds.width - globeCard.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds.height - globeCard.height)).toBeLessThanOrEqual(1);
  const images = page.locator(".experience-choice .artwork img");
  await expect(images).toHaveCount(expectedChannels);
  await expect.poll(() => images.evaluateAll(nodes => nodes.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(page.locator(".poster-tile .art-fallback")).toHaveCount(0);
  await page.screenshot({ path: "test-results/browse-enhancements/globe-sized-tv-posters.png" });
  await page.getByRole("button", { name: "Play UN Web TV", exact: true }).focus();
  await page.getByRole("button", { name: "Play UN Web TV", exact: true }).click();
  const rail = page.getByRole("complementary", { name: "TV channels" });
  await expect(rail.getByRole("button")).toHaveCount(expectedChannels);
  const player = page.getByRole("region", { name: "Selected UN Web TV", exact: true });
  expect((await rail.boundingBox()).x).toBeGreaterThan((await player.boundingBox()).x);
  await rail.getByRole("button", { name: "Watch TV from the Danish Parliament", exact: true }).click();
  await expect(page.getByLabel("TV from the Danish Parliament video", { exact: true })).toBeVisible();
  await expect(page.getByTitle("UN Web TV player", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/livetv\/channel-live-TVfromtheDanishParliament.dk-SD$/);
  await chooseNavigation(page, "Globe");
  await expect(page).toHaveURL(/\/liveglobe$/);
  await page.goBack();
  await expect(page.getByLabel("TV from the Danish Parliament video", { exact: true })).toBeVisible();
  await page.reload();
  await expect(rail.getByRole("button", { name: "Watch TV from the Danish Parliament" })).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: "test-results/browse-enhancements/tv-player-desktop.png" });
});

test("hover expansion reveals a decoded midpoint frame and releases its silent preview", async ({ page }) => {
  const fixture = await recordedPreviewFixture(page);
  await page.route("https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4", route => {
    // Native seeking needs byte ranges, just as the actual movie host provides.
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || "");
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), fixture.length - 1) : fixture.length - 1;
    return route.fulfill({
      status: range ? 206 : 200, contentType: "video/webm",
      headers: {
        "accept-ranges": "bytes", "content-length": String(end - start + 1),
        ...(range ? { "content-range": `bytes ${start}-${end}/${fixture.length}` } : {}),
      },
      body: fixture.subarray(start, end + 1),
    });
  });
  await page.addInitScript(() => {
    window.__midpointPreview = { events: [], frames: [], reveals: [] };
    const discover = () => {
      const video = document.querySelector('.poster-preview video[aria-label="Sintel muted preview"]');
      if (!video || video.__midpointObserved) return;
      video.__midpointObserved = true;
      const evidence = window.__midpointPreview;
      for (const type of ["loadedmetadata", "seeking", "seeked", "playing", "ended"]) {
        video.addEventListener(type, () => evidence.events.push({ type, at: performance.now(), time: video.currentTime, state: video.dataset.state }));
      }
      new MutationObserver(() => {
        if (video.dataset.state === "playing") evidence.reveals.push({ at: performance.now(), time: video.currentTime, duration: video.duration, seeking: video.seeking });
      }).observe(video, { attributes: true, attributeFilter: ["data-state"] });
      const frame = (_now, metadata) => {
        evidence.frames.push({ time: metadata.mediaTime, state: video.dataset.state });
        if (video.isConnected) video.requestVideoFrameCallback(frame);
      };
      video.requestVideoFrameCallback(frame);
    };
    new MutationObserver(discover).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/movies");
  const tile = page.getByRole("group", { name: "Sintel poster", exact: true });
  await tile.evaluate(element => element.addEventListener("mouseenter", () => { window.__cardHoverAt = performance.now(); }, { once: true }));
  await tile.hover();
  const beforeExpansion = await tile.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      elapsed: performance.now() - window.__cardHoverAt,
      opacity: getComputedStyle(element.querySelector(".poster-actions")).opacity,
      actionPointers: [...element.querySelectorAll(".poster-action")].map(action => getComputedStyle(action).pointerEvents),
      hitIsPoster: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest(".experience-choice") === element.querySelector(".experience-choice"),
      expanded: Boolean(document.querySelector(".poster-preview")),
    };
  });
  expect(beforeExpansion.elapsed).toBeLessThan(500);
  expect(beforeExpansion).toMatchObject({ opacity: "0", actionPointers: ["none", "none", "none"], hitIsPoster: true, expanded: false });
  const preview = page.getByRole("region", { name: "Sintel preview", exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".poster-preview-open")).toHaveCount(0);
  await expect(preview.locator(".poster-preview-media svg")).toHaveCount(0);
  const box = await preview.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(500);
  const header = await page.getByRole("navigation", { name: "Krispy menu", exact: true }).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  const poster = preview.getByRole("img", { name: "Sintel poster", exact: true });
  await expect(preview.locator(".artwork")).toHaveCount(1);
  await expect(poster).toHaveCSS("object-fit", "contain");
  const posterBounds = await poster.boundingBox();
  const videoBounds = await preview.locator(".poster-preview-media").boundingBox();
  expect(Math.abs(posterBounds.x - videoBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(posterBounds.width - videoBounds.width)).toBeLessThanOrEqual(1);
  const video = preview.getByLabel("Sintel muted preview");
  try {
    await expect.poll(() => video.evaluate(media => media.dataset.state)).toBe("playing");
  } catch (error) {
    await test.info().attach("midpoint-preview-failure", {
      body: JSON.stringify(await page.evaluate(() => ({
        evidence: window.__midpointPreview,
        media: [...document.querySelectorAll(".poster-preview video")].map(element => ({
          state: element.dataset.state, time: element.currentTime, duration: String(element.duration),
          seeking: element.seeking, paused: element.paused, readyState: element.readyState,
          error: element.error?.message || null,
        })),
      }))),
      contentType: "application/json",
    });
    throw error;
  }
  await expect.poll(() => page.evaluate(() => window.__midpointPreview.frames.filter(frame => frame.state === "playing").length)).toBeGreaterThan(0);
  await expect.poll(() => video.evaluate(media => media.getVideoPlaybackQuality?.().totalVideoFrames || 0)).toBeGreaterThan(1);
  const evidence = await page.evaluate(() => window.__midpointPreview);
  await test.info().attach("native-midpoint-first-reveal", { body: JSON.stringify(evidence), contentType: "application/json" });
  const firstReveal = evidence.reveals[0];
  expect(firstReveal.duration).toBeGreaterThan(7.5);
  expect(firstReveal.duration).toBeLessThan(8.5);
  expect(firstReveal.time).toBeGreaterThanOrEqual(firstReveal.duration / 2 - 0.1);
  expect(firstReveal.time).toBeLessThan(firstReveal.duration / 2 + 0.5);
  expect(firstReveal.seeking).toBe(false);
  expect(evidence.events.some(event => event.type === "seeked" && event.at <= firstReveal.at)).toBe(true);
  expect(evidence.frames.filter(frame => frame.state === "playing").every(frame => frame.time >= firstReveal.duration / 2 - 0.1)).toBe(true);
  expect(await video.evaluate(media => ({ muted: media.muted, paused: media.paused, disablePictureInPicture: media.disablePictureInPicture })))
    .toEqual({ muted: true, paused: false, disablePictureInPicture: true });
  await expect(video).toHaveAttribute("disablepictureinpicture");
  expect(await video.evaluate(media => media.loop)).toBe(false);
  const resource = await video.elementHandle();
  await page.screenshot({ path: "test-results/browse-enhancements/movie-preview.png" });
  await expect.poll(() => video.evaluate(media => media.getAttribute("src"))).toBe(null);
  await expect(video).toHaveAttribute("data-state", "poster");
  expect(await page.evaluate(() => window.__midpointPreview.events.some(event => event.type === "ended"))).toBe(true);
  await nav(page, "TV").hover();
  await expect(preview).toHaveCount(0);
  await expect(page.locator(".hover-preview-video")).toHaveCount(0);
  expect(await resource.evaluate(media => ({ paused: media.paused, src: media.getAttribute("src"), readyState: media.readyState })))
    .toEqual({ paused: true, src: null, readyState: 0 });
  await resource.dispose();
});

test("expanded caption keeps Play and My list usable without an icon over its media", async ({ page }) => {
  await page.goto("/movies?genre=Animation");
  const tile = page.getByRole("group", { name: "Sintel poster", exact: true });
  const preview = page.getByRole("region", { name: "Sintel preview", exact: true });
  await tile.hover();
  await preview.locator(".poster-preview-caption").getByRole("button", { name: "Add Sintel to My list", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Login", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close account", exact: true }).click();
  await nav(page, "Movies").hover();
  await tile.hover();
  await expect(preview.locator(".poster-preview-open")).toHaveCount(0);
  await preview.locator(".poster-preview-caption").getByRole("button", { name: "Play Sintel", exact: true }).click();
  await expect(page.getByRole("region", { name: "Sintel player", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/movie/film-sintel");
});

test("keyboard users retain the small poster Play, My list, and Info actions", async ({ page }) => {
  await page.goto("/movies?genre=Animation");
  const tile = page.getByRole("group", { name: "Sintel poster", exact: true });
  const select = tile.getByRole("button", { name: "Select Sintel", exact: true });
  const play = tile.getByRole("button", { name: "Play Sintel", exact: true });
  const favorite = tile.getByRole("button", { name: "Add Sintel to My list", exact: true });
  const info = tile.getByRole("button", { name: "Info about Sintel", exact: true });
  await select.focus();
  await page.keyboard.press("Tab");
  await expect(play).toBeFocused();
  await expect(tile.locator(".poster-actions")).toHaveCSS("opacity", "1");
  await expect(play).toHaveCSS("pointer-events", "auto");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Sintel player", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close playback", exact: true }).click();
  await expect(play).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(favorite).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Login", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close account", exact: true }).click();
  await expect(favorite).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(info).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "About Sintel", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close information", exact: true }).click();
  await expect(info).toBeFocused();
});

test("touch users can arm and use small poster actions", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
      ? route.continue() : route.abort("blockedbyclient"));
    await page.goto("/movies?genre=Animation");
    const tile = page.getByRole("group", { name: "Sintel poster", exact: true });
    await tile.getByRole("button", { name: "Select Sintel", exact: true }).tap();
    await expect(tile.locator(".poster-actions")).toHaveCSS("opacity", "1");
    await expect(page.locator(".poster-preview")).toHaveCount(0);
    await tile.getByRole("button", { name: "Add Sintel to My list", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Login", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close account", exact: true }).tap();
    await tile.getByRole("button", { name: "Info about Sintel", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "About Sintel", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close information", exact: true }).tap();
    await page.screenshot({ path: "test-results/browse-enhancements/touch-poster-actions.png" });
    await tile.getByRole("button", { name: "Play Sintel", exact: true }).tap();
    await expect(page.getByRole("region", { name: "Sintel player", exact: true })).toBeVisible();
  } finally { await context.close(); }
});

test("Tears of Steel portrait stays complete in a bounded hover card with a soft artwork backdrop", async ({ page }) => {
  for (const [width, height] of [[850, 535], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies?collection=open");
    await page.getByRole("group", { name: "Tears of Steel poster", exact: true }).hover();
    const preview = page.getByRole("region", { name: "Tears of Steel preview", exact: true });
    const poster = preview.getByRole("img", { name: "Tears of Steel poster", exact: true });
    await expect(poster).toHaveAttribute("src", "/art/tears-of-steel.jpg");
    await expect.poll(() => poster.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(poster).toHaveCSS("object-fit", "contain");
    const dimensions = await poster.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
    expect(dimensions.height).toBeGreaterThan(dimensions.width);
    expect(dimensions.width / dimensions.height).toBeCloseTo(720 / 1067, 3);
    const card = await preview.boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(width);
    expect(card.y + card.height).toBeLessThanOrEqual(height);
    const media = await preview.locator(".poster-preview-media").boundingBox();
    const image = await poster.boundingBox();
    await test.info().attach(`portrait-preview-bounds-${width}x${height}`, {
      body: JSON.stringify({ viewport: { width, height }, card, media, image, intrinsic: dimensions }),
      contentType: "application/json",
    });
    expect(image.x).toBeGreaterThanOrEqual(media.x);
    expect(image.y).toBeGreaterThanOrEqual(media.y);
    expect(image.x + image.width).toBeLessThanOrEqual(media.x + media.width + 1);
    expect(image.y + image.height).toBeLessThanOrEqual(media.y + media.height + 1);
    const backdrop = await preview.getByRole("button", { name: "Watch Tears of Steel", exact: true }).evaluate(button => ({
      image: getComputedStyle(button, "::before").backgroundImage,
      filter: getComputedStyle(button, "::before").filter,
    }));
    expect(backdrop.image).toContain("/art/tears-of-steel.jpg");
    expect(backdrop.filter).toContain("blur(");
    await page.screenshot({ path: `test-results/browse-enhancements/portrait-preview-${width}x${height}.png` });
  }
});

test("Danish TV keeps compact hover and accessible license details without remounting video", async ({ page }) => {
  await page.setViewportSize({ width: 850, height: 535 });
  await page.goto("/livetv");
  const title = "TV from the Danish Parliament";
  await page.getByRole("group", { name: `${title} poster`, exact: true }).hover();
  const preview = page.getByRole("region", { name: `${title} preview`, exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("region", { name: "Source and complete licence" })).toHaveCount(0);
  await expect(preview.getByRole("heading", { name: "Source and licence", exact: true })).toHaveCount(0);
  await expect(preview.getByText(/Licence conditions for Danish Parliament TV productions/)).toHaveCount(0);
  const card = await preview.boundingBox();
  const media = await preview.locator(".poster-preview-media").boundingBox();
  expect(card.x).toBeGreaterThanOrEqual(0);
  expect(card.y).toBeGreaterThanOrEqual(0);
  expect(card.x + card.width).toBeLessThanOrEqual(850);
  expect(card.y + card.height).toBeLessThanOrEqual(535);
  expect(card.height).toBeLessThanOrEqual(media.height + 180);
  expect(media.y + media.height).toBeLessThanOrEqual(card.y + card.height);
  expect(await preview.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  await preview.getByRole("button", { name: `Watch ${title}`, exact: true }).click();
  await expect(page).toHaveURL(/\/livetv\/channel-live-TVfromtheDanishParliament.dk-SD$/);
  for (const [width, height] of [[850, 535], [390, 844]]) {
    if (width === 390) {
      await page.setViewportSize({ width, height });
      await page.goto("/livetv/channel-live-TVfromtheDanishParliament.dk-SD");
    }
    const details = page.getByRole("region", { name: "Title details", exact: true });
    const attribution = details.getByText("Attribution", { exact: true }).locator("..").getByRole("definition");
    await expect(attribution).toHaveText("TV from the Danish Parliament — Folketinget (Danish Parliament).");
    const checked = details.getByText("Stream checked", { exact: true }).locator("..").getByRole("definition");
    await expect(checked).toHaveText("October 14, 2026");
    await expect(details).not.toContainText(/\d{4}-\d{2}-\d{2}T\d{2}:/);
    await expect(details.getByText("License", { exact: true })).toHaveCount(0);
    const rights = details.getByRole("region", { name: "License & Rights", exact: true });
    await expect(rights.getByRole("heading", { name: "License & Rights", exact: true })).toBeVisible();
    const official = rights.getByRole("link", { name: /^Official license(?:\s|$)/ });
    await expect(official).toBeVisible();
    await expect(official).toHaveAttribute("href", "https://www.ft.dk/aktuelt/tv-fra-folketinget/deling-og-rettigheder");
    const summary = rights.locator("summary");
    await expect(summary).toHaveText("Read the complete license");
    const complete = rights.getByRole("region", { name: "Complete license text", exact: true, includeHidden: true });
    await expect(complete).toBeHidden();
    await rights.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/browse-enhancements/danish-rights-collapsed-${width}x${height}.png` });
    const video = page.getByLabel(`${title} video`, { exact: true });
    const originalVideo = await video.elementHandle();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(complete).toBeVisible();
    expect(await complete.textContent()).toBe(danishLicense);
    await expect(complete).toHaveAttribute("tabindex", "0");
    await page.keyboard.press("Tab");
    await expect(complete).toBeFocused();
    await expect(complete).toHaveCSS("overflow-y", "auto");
    await complete.scrollIntoViewIfNeeded();
    const licenseBounds = await complete.boundingBox();
    expect(licenseBounds.height).toBeLessThanOrEqual(Math.min(352, height * 0.45) + 1);
    expect(licenseBounds.x).toBeGreaterThanOrEqual(0);
    expect(licenseBounds.x + licenseBounds.width).toBeLessThanOrEqual(width);
    expect(licenseBounds.y).toBeGreaterThanOrEqual(0);
    // Inner scroller offsets round to pixels while line boxes stay fractional.
    expect(licenseBounds.y + licenseBounds.height).toBeLessThanOrEqual(height + 1);
    await page.screenshot({ path: `test-results/browse-enhancements/danish-rights-expanded-${width}x${height}.png` });
    await complete.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await complete.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await summary.focus();
    await page.keyboard.press("Space");
    await expect(complete).toBeHidden();
    await expect(official).toBeVisible();
    await page.keyboard.press("Space");
    await expect(complete).toBeVisible();
    expect(await complete.textContent()).toBe(danishLicense);
    expect(await originalVideo.evaluate(element => element.isConnected)).toBe(true);
    await expect(video).toHaveCount(1);
    await originalVideo.dispose();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await chooseNavigation(page, "Movies");
  await expect(page.locator(".experience-player-overlay")).toHaveCount(0);
});

for (const { title, browsePath, watchURL, media } of [
  { title: "Sintel", browsePath: "/movies", watchURL: /\/movie\/film-sintel\?collection=all&watch=1$/, media: "video" },
  { title: "UN Web TV", browsePath: "/livetv", watchURL: /\/livetv\/channel-live-UNWebTV.us-SD$/, media: "iframe" },
  { title: "Abisko", browsePath: "/liveglobe", watchURL: /\/liveglobe\/destination-abisko$/, media: "iframe" },
]) {
  test(`clicking ${title} hover media opens its full watch route`, async ({ page }) => {
    await page.goto(browsePath);
    await page.getByRole("group", { name: `${title} poster`, exact: true }).hover();
    const preview = page.getByRole("region", { name: `${title} preview`, exact: true });
    await expect(preview.locator(media)).toBeVisible();
    // Exercise the physical hit path through each decorative preview surface.
    const bounds = await preview.locator(media).boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect(page).toHaveURL(watchURL);
    const player = page.getByRole("region", { name: `${title} player`, exact: true });
    await expect(player).toBeVisible();
    await expect(player.locator(media)).toBeVisible();
    await expect(preview).toHaveCount(0);
    await expect(page.locator(".hover-preview-video, .hover-preview-embed")).toHaveCount(0);
    await chooseNavigation(page, "Movies");
    await expect(page).toHaveURL(/\/movies$/);
    await expect(player).toHaveCount(0);
    await expect(page.locator(".experience-player-overlay")).toHaveCount(0);
  });
}

test("Globe hover uses one artwork surface and removes the official player on exit", async ({ page }) => {
  await page.goto("/liveglobe");
  for (const title of ["Abisko", "Alveus Sanctuary"]) {
    await page.getByRole("group", { name: `${title} poster`, exact: true }).hover();
    const preview = page.getByRole("region", { name: `${title} preview`, exact: true });
    await expect(preview.getByRole("img", { name: `${title} poster`, exact: true })).toBeVisible();
    const frame = preview.getByTitle(`${title} muted preview`, { exact: true });
    await expect(frame).toBeVisible();
    const dimensions = await frame.boundingBox();
    expect(dimensions.width).toBeGreaterThanOrEqual(400);
    expect(dimensions.height).toBeGreaterThanOrEqual(300);
    const url = new URL(await frame.getAttribute("src"));
    expect(url.hostname).toBe("player.twitch.tv");
    expect(url.searchParams.get("parent")).toBe("127.0.0.1");
    expect(url.searchParams.get("autoplay")).toBe("true");
    expect(url.searchParams.get("muted")).toBe("true");
    await page.screenshot({ path: `test-results/browse-enhancements/globe-preview-${title.replace(/\s/g, "-")}.png` });
    await nav(page, "Globe").hover();
    await expect(preview).toHaveCount(0);
    await expect(page.locator(".hover-preview-embed iframe")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 850, height: 320 });
  await page.getByRole("group", { name: "Abisko poster", exact: true }).hover();
  const smallPreview = page.getByRole("region", { name: "Abisko preview", exact: true });
  await expect(smallPreview.getByText(/widen.*window/i)).toBeVisible();
  await expect(smallPreview.locator("iframe")).toHaveCount(0);
});

test("phone channel cards stay wide and the channel switcher moves below playback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/livetv");
  await expect(page.getByRole("button", { name: "Open menu", exact: true })).toBeVisible();
  await expect(nav(page, "Movies")).toHaveCount(0);
  const tile = page.getByRole("group", { name: "UN Web TV poster", exact: true });
  const bounds = await tile.boundingBox();
  expect(bounds.width).toBeGreaterThan(bounds.height);
  await page.getByRole("button", { name: "Play UN Web TV", exact: true }).focus();
  await page.getByRole("button", { name: "Play UN Web TV", exact: true }).click();
  const overlay = await page.locator(".experience-player-overlay").boundingBox();
  expect(overlay.x).toBe(0);
  expect(overlay.y).toBe(56);
  expect(overlay.width).toBe(390);
  const rail = page.getByRole("complementary", { name: "TV channels" });
  const player = page.getByRole("region", { name: "Selected UN Web TV", exact: true });
  const playerBounds = await player.boundingBox();
  expect((await rail.boundingBox()).y).toBeGreaterThanOrEqual(playerBounds.y + playerBounds.height);
  await rail.getByRole("button", { name: "Watch TV from the Danish Parliament" }).click();
  await expect(page.getByLabel("TV from the Danish Parliament video", { exact: true })).toBeAttached();
  const switchedPlayerBounds = await page.getByRole("region", { name: "Selected TV from the Danish Parliament", exact: true }).boundingBox();
  expect((await rail.boundingBox()).y).toBeGreaterThanOrEqual(switchedPlayerBounds.y + switchedPlayerBounds.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/browse-enhancements/tv-player-phone.png" });
});

test("short-screen previews fit and Info restores focus to the original poster", async ({ page }) => {
  await page.setViewportSize({ width: 850, height: 320 });
  await page.goto("/movies");
  await page.getByRole("group", { name: "Sintel poster", exact: true }).hover();
  const preview = page.getByRole("region", { name: "Sintel preview", exact: true });
  await expect(preview).toBeVisible();
  const bounds = await preview.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(320);
  await preview.getByRole("button", { name: "Info about Sintel" }).click();
  await page.getByRole("button", { name: "Close information" }).click();
  await expect(page.getByRole("group", { name: "Sintel poster", exact: true }).getByRole("button", { name: "Info about Sintel" })).toBeFocused();
});
