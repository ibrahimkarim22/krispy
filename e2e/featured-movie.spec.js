const { test, expect } = require("@playwright/test");

const featured = page => page.getByRole("region", { name: "Featured movie", exact: true });
const featuredPlay = page => featured(page).getByRole("button", { name: /^(?:Play|Resume) featured Big Buck Bunny$/ });
const featuredInfo = page => featured(page).getByRole("button", { name: "More info about featured Big Buck Bunny", exact: true });
const wall = page => page.getByRole("region", { name: "Title chooser", exact: true });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort("blockedbyclient"));
});

test("Movies opens with a bounded featured film at the top and the poster grid below", async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies");
    await expect(page).toHaveTitle("Movies / Krispy");
    const hero = featured(page);
    await expect(hero).toBeVisible();
    await expect(hero.locator("video")).toHaveCount(0);
    await expect(hero.getByRole("heading", { name: "Big Buck Bunny", exact: true, level: 2 })).toBeVisible();
    const frame = hero.locator(".featured-movie-backdrop");
    await expect(frame).toHaveAttribute("src", "/art/big-buck-bunny-feature.png");
    await expect.poll(() => frame.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(frame).toHaveCSS("object-fit", "cover");
    const dimensions = await frame.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
    expect(dimensions.width).toBeGreaterThanOrEqual(1920);
    expect(dimensions.height).toBeGreaterThanOrEqual(1080);
    expect(dimensions.width).toBeGreaterThan(dimensions.height);
    expect(await wall(page).evaluate(element => element.scrollTop)).toBe(0);
    const bounds = await hero.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(width < 1000 ? 56 : 80);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
    const frameBounds = await frame.boundingBox();
    expect(frameBounds.x).toBeGreaterThanOrEqual(bounds.x);
    expect(frameBounds.y).toBeGreaterThanOrEqual(bounds.y);
    expect(frameBounds.x + frameBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(frameBounds.y + frameBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    for (const control of [featuredPlay(page), featuredInfo(page)]) {
      await expect(control).toBeVisible();
      const button = await control.boundingBox();
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.x).toBeGreaterThanOrEqual(bounds.x);
      expect(button.y).toBeGreaterThanOrEqual(bounds.y);
      expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(button.y + button.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
      expect(button.y + button.height).toBeLessThanOrEqual(height + 1);
      expect(await control.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
    }
    await expect(featuredPlay(page)).toHaveAttribute("data-featured-play");
    const posters = page.locator(".poster-tile");
    expect(await posters.count()).toBeGreaterThan(0);
    const firstPoster = await posters.first().boundingBox();
    expect(firstPoster.y).toBeGreaterThanOrEqual(bounds.y + bounds.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`hero-${width}x${height}.png`) });
  }
});

test("featured Play and Info reuse Big Buck Bunny viewing and restore their hero controls", async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies");
    await featuredPlay(page).click();
    await expect(page).toHaveURL(/\/movie\/film-big-buck-bunny\?collection=all&watch=1$/);
    const player = page.getByRole("region", { name: "Big Buck Bunny player", exact: true });
    await expect(player).toBeVisible();
    await expect(page).toHaveTitle("Big Buck Bunny / Krispy");
    const video = page.getByLabel("Big Buck Bunny video", { exact: true });
    await expect(video).toHaveCount(1);
    expect(await video.evaluate(media => media.muted)).toBe(true);
    expect(await video.evaluate(media => media.disablePictureInPicture)).toBe(false);
    await expect(video).not.toHaveAttribute("disablepictureinpicture");
    await page.getByRole("button", { name: "Close playback", exact: true }).click();
    await expect(player).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/movies");
    await expect(page).toHaveTitle("Movies / Krispy");
    await expect(featuredPlay(page)).toBeVisible();
    await expect(featuredPlay(page)).toBeFocused();
    expect(await wall(page).evaluate(element => element.scrollTop)).toBe(0);

    await featuredInfo(page).click();
    const information = page.getByRole("dialog", { name: "About Big Buck Bunny", exact: true });
    await expect(information).toBeVisible();
    await expect(information.getByRole("region", { name: "Title details", exact: true })).toBeVisible();
    await expect(information.getByRole("heading", { name: "Big Buck Bunny", exact: true })).toBeVisible();
    await information.getByRole("button", { name: "Close information", exact: true }).click();
    await expect(information).toBeHidden();
    await expect(featuredInfo(page)).toBeFocused();
    expect(await wall(page).evaluate(element => element.scrollTop)).toBe(0);
  }
});

test("TV, Globe, and filtered Movies keep their existing browse grids without a featured film", async ({ page }) => {
  for (const path of ["/livetv", "/liveglobe", "/movies?collection=archival", "/movies?genre=Animation"]) {
    await page.goto(path);
    await expect(featured(page)).toHaveCount(0);
    await expect(wall(page)).toBeVisible();
    expect(await page.locator(".poster-tile").count()).toBeGreaterThan(0);
    expect(await wall(page).evaluate(element => element.scrollTop)).toBe(0);
  }
});

test.describe("recorded featured background preview", () => {
  const bunnySource = "https://video.blender.org/object-storage/web_videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4";
  const preview = page => featured(page).locator("video");
  let fixture;

  test.beforeAll(async ({ browser }) => {
    const generator = await browser.newPage();
    try {
      // Real native decoding of recorded test pixels exercises the lifecycle;
      // it does not assert that the external Big Buck Bunny host is reachable.
      fixture = Buffer.from(await generator.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
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
        setTimeout(() => recorder.stop(), 32500);
        await finished;
        clearInterval(timer);
        stream.getTracks().forEach(track => track.stop());
        return Array.from(new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer()));
      }));
      // WebM timestamps use TimecodeScale nanoseconds per tick. Doubling this
      // test-only value turns the 32.5-second recording into 65 media seconds,
      // leaving a full 30 seconds after its midpoint without a longer recording.
      const scale = Buffer.from([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40]);
      const scaleOffset = fixture.indexOf(scale);
      expect(scaleOffset).toBeGreaterThanOrEqual(0);
      fixture.writeUIntBE(2000000, scaleOffset + 4, 3);
    } finally {
      await generator.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      window.__featuredSourceAssignments = [];
      window.__featuredPreviewEvidence = [];
      const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        ...src,
        set(value) {
          if (this.getAttribute("aria-label") === "Big Buck Bunny muted preview") {
            window.__featuredSourceAssignments.push({
              disabled: this.disablePictureInPicture,
              attribute: this.hasAttribute("disablepictureinpicture"),
            });
            const media = this;
            const evidence = { metadata: null, seeks: [], firstReveal: null, lastFrame: null, pauses: [], ended: false };
            window.__featuredPreviewEvidence.push(evidence);
            media.addEventListener("loadedmetadata", () => { evidence.metadata = { duration: media.duration }; });
            media.addEventListener("seeked", () => { evidence.seeks.push(media.currentTime); });
            media.addEventListener("pause", () => { evidence.pauses.push(media.currentTime); });
            media.addEventListener("ended", () => { evidence.ended = true; });
            const frame = (_now, metadata) => {
              evidence.lastFrame = metadata.mediaTime;
              if (media.isConnected && media.getAttribute("src")) media.requestVideoFrameCallback(frame);
            };
            media.requestVideoFrameCallback(frame);
            const observer = new MutationObserver(() => {
              if (media.dataset.state === "playing" && !evidence.firstReveal) {
                evidence.firstReveal = { time: media.currentTime, mediaTime: evidence.lastFrame };
              }
            });
            observer.observe(media, { attributes: true, attributeFilter: ["data-state"] });
          }
          src.set.call(this, value);
        },
      });
    });
    await page.route(bunnySource, route => {
      // Native metadata and midpoint seeking need a seekable byte-range source.
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || "");
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), fixture.length - 1) : fixture.length - 1;
      return route.fulfill({
        status: range ? 206 : 200,
        contentType: "video/webm",
        body: fixture.subarray(start, end + 1),
        headers: {
          "access-control-allow-origin": "*", "cache-control": "no-store",
          "accept-ranges": "bytes", "content-length": String(end - start + 1),
          ...(range ? { "content-range": `bytes ${start}-${end}/${fixture.length}` } : {}),
        },
      });
    });
  });

  async function decodedPreview(page) {
    await expect.poll(() => preview(page).evaluate(media => media.duration)).toBeGreaterThan(64);
    expect(await preview(page).evaluate(media => media.duration)).toBeLessThan(67);
    await expect.poll(() => preview(page).evaluate(media => media.currentTime - media.duration / 2)).toBeGreaterThan(0.2);
    await expect.poll(() => preview(page).evaluate(media => media.getVideoPlaybackQuality?.().totalVideoFrames || media.webkitDecodedFrameCount || 0)).toBeGreaterThan(1);
    expect(await preview(page).evaluate(media => ({ paused: media.paused, muted: media.muted, loop: media.loop, disablePictureInPicture: media.disablePictureInPicture })))
      .toEqual({ paused: false, muted: true, loop: false, disablePictureInPicture: true });
    const assignments = await page.evaluate(() => window.__featuredSourceAssignments);
    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments.every(assignment => assignment.disabled && assignment.attribute)).toBe(true);
    await expect(preview(page)).toHaveCSS("opacity", "1");
    const evidence = await page.evaluate(() => window.__featuredPreviewEvidence.at(-1));
    const midpoint = evidence.metadata.duration / 2;
    expect(evidence.seeks.some(time => Math.abs(time - midpoint) < 0.1)).toBe(true);
    expect(evidence.firstReveal.time).toBeGreaterThanOrEqual(midpoint - 0.1);
    expect(evidence.firstReveal.mediaTime).toBeGreaterThanOrEqual(midpoint - 0.1);
    await expect(page).toHaveTitle("Movies / Krispy");
  }

  test("muted background first reveals its midpoint, decodes thirty relative media seconds, then fades to its poster", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.__featuredLibraryWrites = [];
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function record(key, value) {
        if (String(key).startsWith("krispy.library")) window.__featuredLibraryWrites.push({ key, value });
        return setItem.call(this, key, value);
      };
    });
    await page.goto("/movies");
    await decodedPreview(page);
    const media = await preview(page).elementHandle();
    const initialTime = await media.evaluate(video => {
      // Native decoding still advances the full 30 media seconds; 2x only
      // bounds this regression's wall-clock time and does not seek to the end.
      video.playbackRate = 2;
      return video.currentTime;
    });
    await expect.poll(() => media.evaluate(video => video.currentTime)).toBeGreaterThan(initialTime + 0.5);
    await expect.poll(() => media.evaluate((video, start) => video.currentTime - start, initialTime), { timeout: 10000 }).toBeGreaterThan(10.5);
    expect(await media.evaluate(video => ({ paused: video.paused, state: video.dataset.state })))
      .toEqual({ paused: false, state: "playing" });
    await expect.poll(() => media.evaluate(video => video.getAttribute("src")), { timeout: 18000 }).toBe(null);
    expect(await media.evaluate(video => ({ paused: video.paused, readyState: video.readyState, opacity: getComputedStyle(video).opacity })))
      .toEqual({ paused: true, readyState: 0, opacity: "0" });
    const evidence = await page.evaluate(() => window.__featuredPreviewEvidence.at(-1));
    const stoppedAt = evidence.pauses.find(time => time > evidence.firstReveal.time);
    expect(stoppedAt - evidence.firstReveal.time).toBeGreaterThanOrEqual(29.9);
    expect(stoppedAt - evidence.firstReveal.time).toBeLessThan(30.8);
    expect(stoppedAt).toBeLessThan(evidence.metadata.duration - 1);
    expect(evidence.ended).toBe(false);
    await testInfo.attach("midpoint-preview-evidence", {
      body: JSON.stringify(evidence, null, 2), contentType: "application/json",
    });
    await expect(featured(page).locator(".featured-movie-backdrop")).toHaveAttribute("src", "/art/big-buck-bunny-feature.png");
    await media.evaluate(video => {
      video.dispatchEvent(new Event("canplay"));
      video.dispatchEvent(new Event("playing"));
    });
    await expect.poll(() => media.evaluate(video => ({ paused: video.paused, src: video.getAttribute("src") })))
      .toEqual({ paused: true, src: null });
    expect(await page.evaluate(() => window.__featuredLibraryWrites)).toEqual([]);
    await expect(page).toHaveTitle("Movies / Krispy");
    await media.dispose();
  });

  test("scroll, information, playback, and route changes dispose the background resource", async ({ page }) => {
    const cases = [
      async () => wall(page).evaluate(element => { element.scrollTop = element.scrollHeight; }),
      async () => featuredInfo(page).click(),
      async () => {
        await featuredPlay(page).click();
        await expect(page).toHaveTitle("Big Buck Bunny / Krispy");
      },
      async () => page.getByRole("navigation", { name: "Krispy menu" }).getByRole("button", { name: "TV", exact: true }).click(),
    ];
    for (const leave of cases) {
      await page.goto("/movies");
      await decodedPreview(page);
      const media = await preview(page).elementHandle();
      await leave();
      await expect.poll(() => media.evaluate(video => ({ paused: video.paused, src: video.getAttribute("src"), readyState: video.readyState })))
        .toEqual({ paused: true, src: null, readyState: 0 });
      await media.dispose();
    }
  });
});
