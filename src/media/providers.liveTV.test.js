import { selectProvider, sources, isRegisteredLiveSource } from "./providers";

// Global account setup loads the catalog early; supply an independently adapted fixture registry.
jest.mock("../data/liveTVAdapter", () => {
  const actualAdapter = jest.requireActual("../data/liveTVAdapter");
  const { fixtureLiveCatalog } = require("../data/__fixtures__/liveTVCatalog");
  const catalog = fixtureLiveCatalog();
  const embed = JSON.parse(JSON.stringify(catalog.entries[0]));
  embed.channelId = "FixtureCulture.fr";
  embed.feedKey = "FixtureCulture.fr::English";
  embed.playback.feedKey = embed.feedKey;
  embed.playback.kind = "official-embed";
  embed.playback.url = "https://culture.example.org/player/embed";
  embed.permission.permittedUse = "official-embed";
  embed.playback.permission.permittedUse = "official-embed";
  embed.playback.network.manifestKind = "official-embed";
  embed.playback.network.isLive = null;
  embed.playback.browser.livePlaylistObserved = true;
  catalog.entries.push(embed);
  const adapted = actualAdapter.adaptLiveTVCatalog(catalog);
  return { ...actualAdapter, approvedLiveChannels: adapted.channels, approvedLiveSources: adapted.sources };
});

test("registered approved direct and official iframe sources use the existing providers", () => {
  const direct = sources["live-tv-FixtureNews.us-English"];
  expect(direct).toBeDefined();
  expect(selectProvider(direct, { mse: true }).type).toBe("hls");
  expect(selectProvider(direct, { nativeHls: true }).type).toBe("native-hls");
  const embed = sources["live-tv-FixtureCulture.fr-English"];
  expect(selectProvider(embed).type).toBe("embed");
  expect(selectProvider(embed).url).toBe("https://culture.example.org/player/embed");
});

test("a copied permission object cannot authorize a changed URL, feed or official embed path", () => {
  const direct = sources["live-tv-FixtureNews.us-English"];
  const embed = sources["live-tv-FixtureCulture.fr-English"];
  expect(direct).toBeDefined();
  expect(embed).toBeDefined();
  for (const changed of [
    { ...direct, url: "https://news.example.org/unreviewed.m3u8" },
    { ...direct, feedId: "French" },
    { ...embed, url: "https://culture.example.org/player/another" },
  ]) {
    expect(isRegisteredLiveSource(changed)).toBe(false);
    expect(selectProvider(changed, { mse: true }).type).toBe("offline");
  }
});
