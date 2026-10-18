// Fictional records used only by deterministic tests; never imported by application code.
export function fixtureLiveCatalog() {
  const permission = {
    status: "evidence-found",
    reviewed: true,
    reviewDate: "2026-10-13",
    officialWebsite: "https://news.example.org/",
    provider: { name: "Fixture News", url: "https://news.example.org/" },
    evidenceUrl: "https://news.example.org/terms",
    permittedUse: "direct-hls",
    summary: "Fixture permission for this source",
    conditions: ["Attribute Fixture News"],
    geographicLimitations: [],
    sourceFingerprint: "fixture-primary-source",
  };
  const browser = {
    status: "passed",
    actualPlayer: true,
    userInitiated: true,
    observationSeconds: 20,
    currentTimeAdvanceSeconds: 19,
    decodedFrames: 480,
    fatalErrors: [],
    significantStalls: 0,
    checkedAt: "2026-10-13T14:00:00Z",
    browser: "Fixture Chromium",
    region: "unknown",
    livePlaylistObserved: true,
  };
  const playback = {
    kind: "hls",
    url: "https://news.example.org/live.m3u8",
    feedKey: "FixtureNews.us::English",
    sourceFingerprint: "fixture-primary-source",
    permission,
    browser,
    lastCheckedAt: browser.checkedAt,
    network: {
      status: "passed",
      isLive: true,
      manifestKind: "media",
      checkedAt: browser.checkedAt,
    },
    alternatives: [],
  };
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-13T14:01:00Z",
    entries: [
      {
        channelId: "FixtureNews.us",
        feedId: "English",
        feedKey: "FixtureNews.us::English",
        name: "Fixture News",
        feedName: "English",
        country: { code: "US", name: "United States" },
        languages: [{ code: "eng", name: "English" }],
        categories: [{ id: "news", name: "News" }],
        website: permission.officialWebsite,
        logo: { url: "https://news.example.org/logo.png" },
        enabled: true,
        playback,
        permission,
        availabilityNotes: [],
      },
    ],
  };
}

// Tests independently bind retained permission evidence to the exact channel, feed and URL.
export function sourceFingerprint(candidate, stream) {
  const url = new URL(stream.url);
  url.hash = "";
  return require("node:crypto").createHash("sha256").update(JSON.stringify({
    channelId: candidate.channelId, feedId: candidate.feedId, kind: stream.kind || "hls", url: url.href,
  })).digest("hex");
}
