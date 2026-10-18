const { test, expect } = require("@playwright/test");
const catalog = require("../src/data/liveTV.catalog.json");

const danishTitle = "TV from the Danish Parliament";
const danishEntry = catalog.entries.find(entry => entry.channelId === "TVfromtheDanishParliament.dk");
const unEntry = catalog.entries.find(entry => entry.channelId === "UNWebTV.us");
const danishWatch = "/livetv/channel-live-TVfromtheDanishParliament.dk-SD";
const sintelSource = "https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4";
let fixture;

test.beforeAll(async ({ browser }) => {
  const generator = await browser.newPage();
  try {
    // Generate a tiny, changing picture in memory. This is recorded test media,
    // not broadcaster content or evidence of an actual live stream succeeding.
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
      setTimeout(() => recorder.stop(), 4000);
      await finished;
      clearInterval(timer);
      stream.getTracks().forEach(track => track.stop());
      return Array.from(new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer()));
    }));
  } finally {
    await generator.close();
  }
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => {
    const requestURL = route.request().url();
    if (new URL(requestURL).pathname === "/__fixtures__/native-live.webm" || requestURL === sintelSource) {
      return route.fulfill({
        status: 200,
        contentType: "video/webm",
        body: fixture,
        headers: { "access-control-allow-origin": "*", "cache-control": "no-store" },
      });
    }
    return ["127.0.0.1", "localhost", "[::1]"].includes(new URL(requestURL).hostname)
      ? route.continue() : route.abort("blockedbyclient");
  });
  await page.addInitScript(danishURL => {
    // Chromium can decode this WebM fixture through the native-media branch.
    // HLS demuxing/failover has separate unit coverage; no HLS is fetched here.
    const canPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function canPlay(type) {
      return type === "application/vnd.apple.mpegurl" ? "probably" : canPlayType.call(this, type);
    };
    // Chrome selects HLS demuxing from a .m3u8 path even for a WebM response.
    // Map only the native transport assignment to a loopback fixture path;
    // the app's registered source/catalog and its media event handling stay real.
    const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
    Object.defineProperty(HTMLMediaElement.prototype, "src", {
      ...src,
      set(value) {
        src.set.call(this, value === danishURL
          ? new URL("/__fixtures__/native-live.webm", location.href).href : value);
      },
    });
    window.__liveAutoplayFixture = { calls: [], rejectNext: false, rejections: 0 };
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      const state = window.__liveAutoplayFixture;
      const title = this.getAttribute("aria-label");
      state.calls.push({ title, muted: this.muted });
      if (state.rejectNext && title === "TV from the Danish Parliament video") {
        state.rejectNext = false;
        state.rejections += 1;
        return Promise.reject(new DOMException("Fixture autoplay blocked", "NotAllowedError"));
      }
      return originalPlay.call(this);
    };
  }, danishEntry.playback.url);
});

const playerFor = (page, title) => page.getByRole("region", { name: `${title} player`, exact: true });
const mainVideo = (page, title) => page.getByLabel(`${title} video`, { exact: true });
const playCalls = (page, title) => page.evaluate(label => window.__liveAutoplayFixture.calls.filter(call => call.title === label), `${title} video`);

async function expectDecodedPlayback(video) {
  await expect.poll(() => video.evaluate(media => media.currentTime)).toBeGreaterThan(0.2);
  await expect.poll(() => video.evaluate(media => media.getVideoPlaybackQuality?.().totalVideoFrames || media.webkitDecodedFrameCount || 0)).toBeGreaterThan(1);
  expect(await video.evaluate(media => media.paused)).toBe(false);
}

test("recorded native TV fixture autoplays muted once, respects pause, and cleans up on channel switches", async ({ page }) => {
  await page.goto(danishWatch);
  const video = mainVideo(page, danishTitle);
  await expectDecodedPlayback(video);
  expect(await video.evaluate(media => media.muted)).toBe(true);
  expect(await playCalls(page, danishTitle)).toEqual([{ title: `${danishTitle} video`, muted: true }]);
  await playerFor(page, danishTitle).getByRole("button", { name: "Pause", exact: true }).click();
  await video.evaluate(media => new Promise(resolve => {
    media.dispatchEvent(new Event("canplay"));
    media.dispatchEvent(new Event("canplay"));
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  expect(await video.evaluate(media => media.paused)).toBe(true);
  expect(await playCalls(page, danishTitle)).toHaveLength(1);

  const originalVideo = await video.elementHandle();
  const rail = page.getByRole("complementary", { name: "TV channels", exact: true });
  await rail.getByRole("button", { name: "Watch UN Web TV", exact: true }).click();
  await expect(page.getByTitle("UN Web TV player", { exact: true })).toBeVisible();
  expect(await originalVideo.evaluate(media => ({ connected: media.isConnected, paused: media.paused, src: media.getAttribute("src") })))
    .toEqual({ connected: false, paused: true, src: null });
  await rail.getByRole("button", { name: `Watch ${danishTitle}`, exact: true }).click();
  await expectDecodedPlayback(video);
  expect(await video.evaluate(media => media.muted)).toBe(true);
  expect(await playCalls(page, danishTitle)).toHaveLength(2);
  await originalVideo.dispose();
});

test("blocked fixture autoplay leaves Play available and supports manual playback with sound", async ({ page }) => {
  await page.goto("/livetv");
  await page.evaluate(() => { window.__liveAutoplayFixture.rejectNext = true; });
  const open = page.getByRole("button", { name: `Play ${danishTitle}`, exact: true });
  await open.focus();
  await open.click();
  const player = playerFor(page, danishTitle);
  const video = mainVideo(page, danishTitle);
  await expect.poll(() => page.evaluate(() => window.__liveAutoplayFixture.rejections)).toBe(1);
  await expect(player.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await video.evaluate(media => ({ paused: media.paused, muted: media.muted })))
    .toEqual({ paused: true, muted: true });
  expect(await playCalls(page, danishTitle)).toHaveLength(1);
  await player.getByRole("button", { name: "Unmute", exact: true }).click();
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await expectDecodedPlayback(video);
  expect(await video.evaluate(media => media.muted)).toBe(false);
  await expect(player.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
  expect(await playCalls(page, danishTitle)).toEqual([
    { title: `${danishTitle} video`, muted: true },
    { title: `${danishTitle} video`, muted: false },
  ]);
});

test("Globe requests muted official autoplay while UN preserves its exact manual embed", async ({ page }) => {
  await page.goto("/liveglobe/destination-abisko");
  const globe = page.getByTitle("Abisko player", { exact: true });
  await expect(globe).toBeVisible();
  const globeURL = new URL(await globe.getAttribute("src"));
  expect(globeURL.hostname).toBe("player.twitch.tv");
  expect(globeURL.searchParams.get("autoplay")).toBe("true");
  expect(globeURL.searchParams.get("muted")).toBe("true");
  expect(globeURL.searchParams.getAll("parent")).toEqual([new URL(page.url()).hostname]);
  expect((await globe.getAttribute("allow")).split(";").map(value => value.trim())).toContain("autoplay");
  await page.goto("/livetv/channel-live-UNWebTV.us-SD");
  const official = page.getByTitle("UN Web TV player", { exact: true });
  await expect(official).toBeVisible();
  await expect(official).toHaveAttribute("src", new URL(unEntry.playback.url).href);
  expect((await official.getAttribute("allow")).split(";").map(value => value.trim())).not.toContain("autoplay");
  await expect(official).toHaveAttribute("tabindex", "0");
  await expect(official).not.toHaveAttribute("aria-hidden", "true");
});

test("recorded Movie fixture starts muted and remains paused until the viewer presses Play", async ({ page }) => {
  await page.goto("/movie/film-sintel?collection=all&watch=1");
  const video = mainVideo(page, "Sintel");
  await expect.poll(() => video.evaluate(media => media.readyState)).toBeGreaterThanOrEqual(3);
  expect(await video.evaluate(media => ({ paused: media.paused, muted: media.muted, time: media.currentTime })))
    .toEqual({ paused: true, muted: true, time: 0 });
  expect(await playCalls(page, "Sintel")).toEqual([]);
  const player = playerFor(page, "Sintel");
  await player.getByRole("button", { name: "Play", exact: true }).click();
  await expectDecodedPlayback(video);
  expect(await video.evaluate(media => media.muted)).toBe(true);
  expect(await playCalls(page, "Sintel")).toEqual([{ title: "Sintel video", muted: true }]);
  await player.getByRole("button", { name: "Unmute", exact: true }).click();
  expect(await video.evaluate(media => media.muted)).toBe(false);
  await expect(player.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
});
