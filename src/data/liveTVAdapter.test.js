import { adaptLiveTVCatalog } from "./liveTVAdapter";
import { fixtureLiveCatalog } from "./__fixtures__/liveTVCatalog";

test("approved catalog adapts into existing channel and source models with stable IDs", () => {
  const { channels, sources } = adaptLiveTVCatalog(fixtureLiveCatalog());
  expect(channels).toHaveLength(1);
  expect(channels[0]).toMatchObject({
    id: "channel-live-FixtureNews.us-English",
    type: "channel",
    title: "Fixture News",
    country: "United States",
    countryCode: "US",
    language: "English",
    languages: ["English"],
    languageCodes: ["eng"],
    genres: ["News"],
    isLive: true,
    isCuratedLive: true,
    artworkKind: "broadcaster-logo",
    artwork: "https://news.example.org/logo.png",
  });
  expect(sources[channels[0].sourceId]).toMatchObject({
    origin: "curated-live-tv",
    channelId: "FixtureNews.us",
    feedId: "English",
    kind: "hls",
    url: "https://news.example.org/live.m3u8",
    permissionUrl: "https://news.example.org/terms",
  });
});

test("malformed, disabled, unreviewed and untested records stay outside the shipped lineup", () => {
  const catalog = fixtureLiveCatalog();
  for (const mutate of [
    (entry) => {
      entry.enabled = false;
    },
    (entry) => {
      entry.permission.reviewed = false;
    },
    (entry) => {
      entry.permission.status = "needs-review";
    },
    (entry) => {
      entry.playback.browser.decodedFrames = 0;
    },
    (entry) => {
      entry.playback.browser.observationSeconds = 19;
    },
    (entry) => {
      entry.playback.network.isLive = false;
    },
    (entry) => {
      entry.playback.browser.livePlaylistObserved = false;
    },
    (entry) => {
      entry.permission.noOverlays = true;
    },
    (entry) => {
      entry.playback.sourceFingerprint = "changed-source";
    },
    (entry) => {
      entry.playback.url = "http://news.example.org/live.m3u8";
    },
    (entry) => {
      entry.languages = [];
    },
  ]) {
    const changed = JSON.parse(JSON.stringify(catalog));
    mutate(changed.entries[0]);
    expect(adaptLiveTVCatalog(changed).channels).toHaveLength(0);
  }
  expect(
    adaptLiveTVCatalog({ schemaVersion: 2, entries: catalog.entries }).channels,
  ).toHaveLength(0);
  expect(
    adaptLiveTVCatalog({ schemaVersion: 1, entries: [null, {}] }).channels,
  ).toHaveLength(0);
});

test("alternate sources need complete approval and stay on the exact same feed", () => {
  const catalog = fixtureLiveCatalog();
  const entry = catalog.entries[0];
  entry.playback.alternatives = [
    {
      ...entry.playback,
      url: "https://news.example.org/backup.m3u8",
      sourceFingerprint: "fixture-backup-source",
      permission: {
        ...entry.permission,
        sourceFingerprint: "fixture-backup-source",
      },
    },
    {
      ...entry.playback,
      url: "https://news.example.org/french.m3u8",
      feedKey: "FixtureNews.us::French",
    },
    {
      ...entry.playback,
      url: "https://news.example.org/unreviewed.m3u8",
      permission: { ...entry.permission, reviewed: false },
    },
  ];
  const { channels, sources } = adaptLiveTVCatalog(catalog);
  expect(sources[channels[0].sourceId].alternatives).toHaveLength(1);
  expect(sources[channels[0].sourceId].alternatives[0].url).toBe(
    "https://news.example.org/backup.m3u8",
  );
});

test("local diagnostic playback never enters the public channel or source registry", () => {
  for (const marker of ["localDiagnostic", "technicalOnly"]) {
    const catalog = fixtureLiveCatalog();
    catalog.entries[0].playback.browser[marker] = true;
    const { channels, sources } = adaptLiveTVCatalog(catalog);
    expect(channels).toEqual([]);
    expect(sources).toEqual({});
  }
});

test("official embed remains an iframe and does not acquire a direct HLS source", () => {
  const catalog = fixtureLiveCatalog();
  const entry = catalog.entries[0];
  entry.playback.kind = "official-embed";
  entry.playback.url = "https://news.example.org/official/embed";
  entry.permission.permittedUse = "official-embed";
  entry.playback.network.manifestKind = "official-embed";
  entry.playback.network.isLive = null;
  entry.playback.browser.livePlaylistObserved = true;
  const { channels, sources } = adaptLiveTVCatalog(catalog);
  expect(sources[channels[0].sourceId].kind).toBe("embed");
  expect(sources[channels[0].sourceId].url).toBe(
    "https://news.example.org/official/embed",
  );
  entry.playback.browser.livePlaylistObserved = false;
  expect(adaptLiveTVCatalog(catalog).channels).toHaveLength(0);
});

test("missing logos use existing artwork fallback and duplicates never create extra channels", () => {
  const catalog = fixtureLiveCatalog();
  catalog.entries[0].logo = null;
  catalog.entries.push(catalog.entries[0]);
  const { channels } = adaptLiveTVCatalog(catalog);
  expect(channels).toHaveLength(1);
  expect(channels[0].artwork).toBeUndefined();
  expect(channels[0].fallbackSrc).toBeUndefined();
});

test("permission conditions retain the complete licence link and suppress separately prohibited logos", () => {
  const catalog = fixtureLiveCatalog();
  catalog.entries[0].permission.fullLicenseUrl =
    "https://news.example.org/full-license";
  catalog.entries[0].permission.logoUsageAllowed = false;
  const { channels, sources } = adaptLiveTVCatalog(catalog);
  expect(channels[0].artwork).toBeUndefined();
  expect(channels[0].artworkCredit).toBeUndefined();
  expect(channels[0].licenseUrl).toBe("https://news.example.org/full-license");
  expect(sources[channels[0].sourceId].permission.fullLicenseUrl).toBe(
    "https://news.example.org/full-license",
  );
  expect(channels[0].attribution).toContain(
    "https://news.example.org/full-license",
  );
});

test("Danish display credit names the broadcaster while the source retains every permission condition and licence", () => {
  const catalog = JSON.parse(JSON.stringify(require("./liveTV.catalog.json")));
  const entry = catalog.entries.find((entry) => entry.channelId === "TVfromtheDanishParliament.dk");
  const original = JSON.stringify(entry);
  const { channels, sources } = adaptLiveTVCatalog(catalog);
  const item = channels.find((item) => item.channelId === entry.channelId);
  const source = sources[item.sourceId];
  expect(item.attribution).toBe("TV from the Danish Parliament — Folketinget (Danish Parliament).");
  expect(source.attribution).toContain(entry.permission.conditions[0]);
  expect(source.attribution).toContain(entry.permission.fullLicenseUrl);
  expect(item.license).toBe(entry.permission.fullLicenseText);
  expect(item.licenseUrl).toBe(entry.permission.fullLicenseUrl);
  expect(source.permission).toBe(entry.permission);
  expect(source.sourceFingerprint).toBe(entry.playback.sourceFingerprint);
  expect(source.alternatives[0].license).toBe(entry.playback.alternatives[0].permission.fullLicenseText);
  expect(JSON.stringify(entry)).toBe(original);
  const other = channels.find((item) => item.channelId === "UNWebTV.us");
  expect(other.attribution).toBe(sources[other.sourceId].attribution);
});

test.each([
  ["TVfromtheDanishParliament.dk", "/art/tv-cover-danish-parliament.svg"],
  ["UNWebTV.us", "/art/tv-cover-un-web-tv.svg"],
])("%s uses original architecture cover art while its institution logo remains prohibited", (channelId, cover) => {
  const catalog = JSON.parse(JSON.stringify(require("./liveTV.catalog.json")));
  const entry = catalog.entries.find((entry) => entry.channelId === channelId);
  expect(entry.permission.noStandaloneLogo).toBe(true);
  entry.logo = { url: "https://institution.example.org/forbidden-logo.svg" };
  const { channels, sources } = adaptLiveTVCatalog(catalog);
  const item = channels.find((item) => item.channelId === channelId);
  expect(item).toMatchObject({
    artwork: cover,
    artworkKind: "editorial-illustration",
    artworkCredit: expect.stringContaining("Krispy original illustration"),
    requiresUnmodifiedPresentation: true,
  });
  expect(item.artworkCredit).not.toContain(entry.logo.url);
  expect(sources[item.sourceId]).toMatchObject({
    url: entry.playback.url, sourceFingerprint: entry.playback.sourceFingerprint,
    permission: entry.permission,
  });
});

test.each([{ noOverlays: true }, { logoUsageAllowed: false }])(
  "an approved alternate preserves the picture boundary when its grant requires %o",
  (constraint) => {
    const catalog = fixtureLiveCatalog();
    const entry = catalog.entries[0];
    entry.playback.alternatives = [
      {
        ...entry.playback,
        url: "https://news.example.org/licensed-backup.m3u8",
        sourceFingerprint: "licensed-backup",
        permission: {
          ...entry.permission,
          sourceFingerprint: "licensed-backup",
          ...constraint,
        },
        browser: {
          ...entry.playback.browser,
          presentation: {
            appElementsOverPicture: 0,
            controlsOutsidePicture: true,
            creditOutsidePicture: true,
            licenceLinkAvailable: true,
            licenceTextAvailable: true,
          },
        },
      },
    ];
    const { channels, sources } = adaptLiveTVCatalog(catalog);
    expect(sources[channels[0].sourceId].alternatives).toHaveLength(1);
    expect(channels[0].requiresUnmodifiedPresentation).toBe(true);
    expect(channels[0].artwork).toBe(constraint.logoUsageAllowed === false ? undefined : entry.logo.url);
  },
);

test("a constrained alternative from another feed or without approval does not change the current picture boundary", () => {
  const catalog = fixtureLiveCatalog();
  const entry = catalog.entries[0];
  entry.playback.alternatives = [
    {
      ...entry.playback,
      feedKey: "FixtureNews.us::French",
      permission: { ...entry.permission, noOverlays: true },
    },
    {
      ...entry.playback,
      permission: { ...entry.permission, noOverlays: true, reviewed: false },
    },
  ];
  const { channels, sources } = adaptLiveTVCatalog(catalog);
  expect(sources[channels[0].sourceId].alternatives).toEqual([]);
  expect(channels[0].requiresUnmodifiedPresentation).toBe(false);
});
